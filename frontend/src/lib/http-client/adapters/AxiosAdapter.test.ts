import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { AxiosAdapter } from './AxiosAdapter';

vi.mock('axios');

describe('AxiosAdapter', () => {
  let adapter: AxiosAdapter;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      defaults: { headers: { common: {} } },
    };
    (axios.create as any).mockReturnValue(mockAxiosInstance);
    // Mock axios.isAxiosError
    (axios.isAxiosError as any) = vi.fn((payload) => payload?.isAxiosError === true);

    adapter = new AxiosAdapter({ baseURL: 'http://test.com' });
  });

  it('should use default apiPrefix /portal if not provided', () => {
    // Re-create adapter without baseURL to test default prefix logic
    new AxiosAdapter({});
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: '/portal'
    }));
  });

  it('should use provided apiPrefix', () => {
    new AxiosAdapter({ apiPrefix: '/api' });
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: '/api'
    }));
  });

  it('should combine baseURL and apiPrefix', () => {
    new AxiosAdapter({ baseURL: 'http://host.com', apiPrefix: '/api' });
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: 'http://host.com/api'
    }));
  });

  it('should return result object if present in successful response', async () => {
    const mockResult = { id: 1, name: 'test' };
    const mockResponse = {
      data: {
        id: "api.test",
        responseCode: "OK",
        result: mockResult
      },
      status: 200,
      headers: {}
    };
    mockAxiosInstance.get.mockResolvedValue(mockResponse);

    const result = await adapter.get('/test');
    expect(result.data).toEqual(mockResult);
    expect(result.status).toBe(200);
  });

  it('should return full data if result is missing in successful response', async () => {
    const mockData = { id: 1, name: 'test' }; // No 'result' key
    const mockResponse = { data: mockData, status: 200, headers: {} };
    mockAxiosInstance.get.mockResolvedValue(mockResponse);

    const result = await adapter.get('/test');
    expect(result.data).toEqual(mockData);
  });

  it('should throw with error message on 4xx/5xx response', async () => {
    const mockResponse = { data: { params: { errmsg: 'Something went wrong' } }, status: 500, headers: {} };

    const error: any = new Error('Server Error');
    error.isAxiosError = true;
    error.response = mockResponse;

    mockAxiosInstance.get.mockRejectedValue(error);

    await expect(adapter.get('/test')).rejects.toThrow('Something went wrong');
  });

  it('should throw with request failed message when params.errmsg is missing', async () => {
    const mockResponse = { data: {}, status: 500, headers: {} };

    const error: any = new Error('Server Error');
    error.isAxiosError = true;
    error.response = mockResponse;

    mockAxiosInstance.get.mockRejectedValue(error);

    await expect(adapter.get('/test')).rejects.toThrow('Server Error');
  });

  it('should attach status code to thrown error for 4xx responses', async () => {
    const mockResponse = { data: { params: { errmsg: 'Forbidden' } }, status: 403, headers: {} };
    const error: any = new Error('Forbidden');
    error.isAxiosError = true;
    error.response = mockResponse;

    mockAxiosInstance.get.mockRejectedValue(error);

    const thrown = await adapter.get('/test').catch((e) => e);
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as any).status).toBe(403);
    expect(thrown.message).toBe('Forbidden');
  });

  it('should attach params.err and result to the thrown error so callers can render structured 4xx bodies', async () => {
    const result = { valid: false, summary: { errors: 1 }, rows: [{ index: 0, status: 'FAILED' }] };
    const mockResponse = {
      data: { params: { err: 'ERR_VALIDATION_FAILED', errmsg: 'One or more rows failed validation' }, result },
      status: 400,
      headers: {},
    };
    const error: any = new Error('Bad Request');
    error.isAxiosError = true;
    error.response = mockResponse;

    mockAxiosInstance.post.mockRejectedValue(error);

    const thrown = await adapter.post('/test', {}).catch((e) => e);
    expect(thrown.message).toBe('One or more rows failed validation');
    expect(thrown.errCode).toBe('ERR_VALIDATION_FAILED');
    expect(thrown.result).toEqual(result);
  });

  it('should attach status code to thrown error for 5xx responses', async () => {
    const mockResponse = { data: { params: { errmsg: 'Internal Server Error' } }, status: 500, headers: {} };
    const error: any = new Error('Internal Server Error');
    error.isAxiosError = true;
    error.response = mockResponse;

    mockAxiosInstance.get.mockRejectedValue(error);

    const thrown = await adapter.get('/test').catch((e) => e);
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as any).status).toBe(500);
    expect(thrown.message).toBe('Internal Server Error');
  });

  it('should invoke status handlers for 401/403 errors', async () => {
    const handler = vi.fn();
    adapter = new AxiosAdapter({
      baseURL: 'http://test.com',
      statusHandlers: { 403: handler },
    });

    const mockResponse = { data: null, status: 403, headers: {} };
    const error: any = new Error('Forbidden');
    error.isAxiosError = true;
    error.response = mockResponse;

    mockAxiosInstance.get.mockRejectedValue(error);

    await expect(adapter.get('/test')).rejects.toThrow('Forbidden');
    expect(handler).toHaveBeenCalledWith({
      data: null,
      status: 403,
      headers: {},
    });
  });

  it('should not invoke status handlers for other 4xx errors', async () => {
    const handler = vi.fn();
    adapter = new AxiosAdapter({
      baseURL: 'http://test.com',
      statusHandlers: { 404: handler },
    });

    const mockResponse = { data: null, status: 404, headers: {} };
    const error: any = new Error('Not Found');
    error.isAxiosError = true;
    error.response = mockResponse;

    mockAxiosInstance.get.mockRejectedValue(error);

    await expect(adapter.get('/test')).rejects.toThrow('Not Found');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should add headers using updateHeaders', () => {
    adapter.updateHeaders([
      { key: 'Authorization', value: 'Bearer token123', action: 'add' },
      { key: 'X-Custom-Header', value: 'CustomValue', action: 'add' },
    ]);
    expect(mockAxiosInstance.defaults.headers.common['Authorization']).toBe('Bearer token123');
    expect(mockAxiosInstance.defaults.headers.common['X-Custom-Header']).toBe('CustomValue');
  });

  it('should remove headers using updateHeaders', () => {
    mockAxiosInstance.defaults.headers.common['Authorization'] = 'Bearer token123';
    mockAxiosInstance.defaults.headers.common['X-Custom-Header'] = 'CustomValue';

    adapter.updateHeaders([
      { key: 'Authorization', action: 'remove' },
    ]);

    expect(mockAxiosInstance.defaults.headers.common['Authorization']).toBeUndefined();
    expect(mockAxiosInstance.defaults.headers.common['X-Custom-Header']).toBe('CustomValue');
  });

  it('should call _post via public post and return correct response', async () => {
    const mockResult = { created: true };
    const mockResponse = {
      data: { result: mockResult },
      status: 201,
      headers: {},
    };
    mockAxiosInstance.post.mockResolvedValue(mockResponse);

    const result = await adapter.post('/test', { key: 'value' });
    expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test', { key: 'value' }, { headers: undefined });
    expect(result.data).toEqual(mockResult);
    expect(result.status).toBe(201);
  });

  it('should call _put via public put and return correct response', async () => {
    const mockResult = { updated: true };
    const mockResponse = {
      data: { result: mockResult },
      status: 200,
      headers: {},
    };
    mockAxiosInstance.put.mockResolvedValue(mockResponse);

    const result = await adapter.put('/test', { key: 'value' });
    expect(mockAxiosInstance.put).toHaveBeenCalledWith('/test', { key: 'value' }, { headers: undefined });
    expect(result.data).toEqual(mockResult);
    expect(result.status).toBe(200);
  });

  it('should call _patch via public patch and return correct response', async () => {
    const mockResult = { patched: true };
    const mockResponse = {
      data: { result: mockResult },
      status: 200,
      headers: {},
    };
    mockAxiosInstance.patch.mockResolvedValue(mockResponse);

    const result = await adapter.patch('/test', { key: 'value' });
    expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/test', { key: 'value' }, { headers: undefined });
    expect(result.data).toEqual(mockResult);
    expect(result.status).toBe(200);
  });

  it('should call _delete via public delete and return correct response', async () => {
    const mockResponse = {
      data: {},
      status: 204,
      headers: {},
    };
    mockAxiosInstance.delete.mockResolvedValue(mockResponse);

    const result = await adapter.delete('/test');
    expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/test', { headers: undefined, data: undefined });
    expect(result.status).toBe(204);
  });

  it('should invoke onResponse handler for 401 responses', async () => {
    const handler = vi.fn();
    adapter = new AxiosAdapter({
      baseURL: 'http://test.com',
      statusHandlers: { 401: handler },
    });

    const mockResponse = { data: null, status: 401, headers: {} };
    const error: any = new Error('Unauthorized');
    error.isAxiosError = true;
    error.response = mockResponse;

    mockAxiosInstance.get.mockRejectedValue(error);

    await expect(adapter.get('/test')).rejects.toThrow('Unauthorized');
    expect(handler).toHaveBeenCalledWith({
      data: null,
      status: 401,
      headers: {},
    });
  });
});
