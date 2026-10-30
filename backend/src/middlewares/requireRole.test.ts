import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requireRole } from './requireRole.js';

vi.mock('../utils/logger.js', () => ({
    default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe('requireRole', () => {
    let res: Partial<Response>;
    let next: NextFunction;

    const reqWith = (roles?: string[]) =>
        ({ method: 'POST', originalUrl: '/portal/x', session: roles ? { roles } : undefined }) as unknown as Request;

    beforeEach(() => {
        res = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
        next = vi.fn();
    });

    it('calls next when the session holds an allowed role', () => {
        requireRole(['ORG_ADMIN'])(reqWith(['PUBLIC', 'ORG_ADMIN']), res as Response, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('403s a logged-in user without an allowed role', () => {
        requireRole(['ORG_ADMIN'])(reqWith(['PUBLIC', 'CONTENT_CREATOR']), res as Response, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(vi.mocked(res.send!).mock.calls[0]?.[0]).toMatchObject({ params: { err: 'ERR_FORBIDDEN' } });
    });

    it('403s when there is no session at all', () => {
        requireRole(['ORG_ADMIN'])(reqWith(), res as Response, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });
});
