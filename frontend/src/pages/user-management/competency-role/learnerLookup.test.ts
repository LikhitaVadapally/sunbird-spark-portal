import { describe, it, expect } from 'vitest';
import { learnerQueryKind, toFoundUser } from './learnerLookup';

describe('learnerQueryKind', () => {
  it('reads a Sunbird user ID, an email or a username', () => {
    expect(learnerQueryKind(' 00baafef-f85d-4476-80ac-baf63d2ca7d5 ')).toBe('id');
    expect(learnerQueryKind('asha@example.com')).toBe('email');
    expect(learnerQueryKind('asha_1')).toBe('userName');
  });
});

describe('toFoundUser', () => {
  it('prefers userId and labels with name and username', () => {
    expect(toFoundUser({ userId: 'u1', id: 'x', firstName: 'Asha', lastName: 'Rao', userName: 'asha_1' }))
      .toEqual({ id: 'u1', label: 'Asha Rao (asha_1)' });
  });

  it('falls back to the masked email, then the id', () => {
    expect(toFoundUser({ id: 'u2', maskedEmail: 'as**@example.com' })?.label).toBe('as**@example.com');
    expect(toFoundUser({ id: 'u3' })?.label).toBe('u3');
  });

  it('drops a user with no id', () => {
    expect(toFoundUser({ firstName: 'Ghost' })).toBeUndefined();
  });
});
