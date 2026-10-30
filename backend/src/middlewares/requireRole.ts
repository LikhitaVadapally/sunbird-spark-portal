import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Response as ApiResponse } from '../models/Response.js';
import logger from '../utils/logger.js';

/**
 * Allows the request only if the session holds at least one of `allowedRoles`.
 *
 * `requireAuth()` only proves *someone* is logged in, and the upstream Knowlg taxonomy APIs do
 * no role checks of their own, so admin-only writes proxied through the `/portal` catch-all
 * would otherwise be open to any learner. Roles come from `req.session.roles`, populated from
 * the user profile at login (services/userService.ts#setUserSession). Mount after requireAuth().
 */
export const requireRole = (allowedRoles: string[]): RequestHandler =>
    (req: Request, res: Response, next: NextFunction): void => {
        const roles = req.session?.roles ?? [];
        if (roles.some((role) => allowedRoles.includes(role))) {
            next();
            return;
        }
        logger.warn(`requireRole :: rejected ${req.method} ${req.originalUrl} (needs one of ${allowedRoles.join(', ')})`);
        const response = new ApiResponse('api.error');
        response.setError({
            err: 'ERR_FORBIDDEN',
            errmsg: 'You do not have permission to perform this action',
            responseCode: 'FORBIDDEN',
        });
        res.status(403).send(response);
    };
