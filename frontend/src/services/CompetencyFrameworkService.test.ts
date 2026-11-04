import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompetencyFrameworkService, buildBlankTermSheet } from './CompetencyFrameworkService';
import { IHttpClient, init } from '../lib/http-client';

describe('CompetencyFrameworkService', () => {
  let mockClient: IHttpClient;
  const service = new CompetencyFrameworkService();

  beforeEach(() => {
    mockClient = {
      get: vi.fn().mockResolvedValue({ data: {}, status: 200, headers: {} }),
      post: vi.fn().mockResolvedValue({ data: {}, status: 200, headers: {} }),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      updateHeaders: vi.fn(),
    };
    init(mockClient);
  });

  it('creates under the competencyFramework body key the controller reads', async () => {
    const input = { name: 'Nursing', code: 'nursing_skills', channel: 'ch1', description: 'd' };
    await service.create(input);
    expect(mockClient.post).toHaveBeenCalledWith('/competency-framework/v3/create', {
      request: { competencyFramework: input },
    });
  });

  it('reads and publishes by an encoded identifier', async () => {
    await service.read('fw 1');
    expect(mockClient.get).toHaveBeenCalledWith('/competency-framework/v3/read/fw%201');
    await service.publish('fw1');
    expect(mockClient.post).toHaveBeenCalledWith('/competency-framework/v3/publish/fw1', { request: {} });
  });

  it('lists draft and live competency frameworks via composite search', async () => {
    await service.list();
    expect(mockClient.post).toHaveBeenCalledWith('/composite/v1/search', {
      request: expect.objectContaining({
        filters: { objectType: ['CompetencyFramework'], status: ['Draft', 'Live'] },
        sort_by: { lastUpdatedOn: 'desc' },
      }),
    });
  });

  it('scopes the list to the admin channel and asks only for picker fields', async () => {
    await service.list('ch1');
    expect(mockClient.post).toHaveBeenCalledWith('/composite/v1/search', {
      request: expect.objectContaining({
        filters: { objectType: ['CompetencyFramework'], status: ['Draft', 'Live'], channel: ['ch1'] },
        fields: ['identifier', 'name', 'status', 'channel'],
      }),
    });
  });

  it('attaches a category through the v1 category create route', async () => {
    await service.attachCategory('fw 1', { code: 'skill', name: 'Skill' });
    expect(mockClient.post).toHaveBeenCalledWith('/framework/v1/category/create?framework=fw%201', {
      request: { category: { code: 'skill', name: 'Skill' } },
    });
  });

  it('asks for the term export of a framework', async () => {
    await service.downloadTerms('fw1');
    expect(mockClient.get).toHaveBeenCalledWith('/framework/v3/term/download/fw1');
  });

  it.each([
    ['validateTerms', '/framework/v3/term/validate'],
    ['commitTerms', '/framework/v3/term/commit'],
  ] as const)('%s posts multipart with the framework field and the file', async (method, url) => {
    const file = new File(['Category,Name,Code,Associated Terms,Description\n'], 'skills.csv', { type: 'text/csv' });
    await service[method]('fw1', file);
    const [calledUrl, body] = vi.mocked(mockClient.post).mock.calls[0] ?? [];
    expect(calledUrl).toBe(url);
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('framework')).toBe('fw1');
    expect(((body as FormData).get('file') as File).name).toBe('skills.csv');
  });

  it('builds a blank template with exactly the headers TermSheetReader requires', () => {
    expect(buildBlankTermSheet()).toBe('Category,Name,Code,Associated Terms,Description\n');
  });
});
