import { Request, Response, NextFunction } from 'express';

const EXTRA_HEADERS: Record<string, string> = {
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-XSS-Protection': '0',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Server': 'ServiceTicket',
};

export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
    for (const [key, value] of Object.entries(EXTRA_HEADERS)) {
        if (!res.getHeader(key)) {
            res.setHeader(key, value);
        } else {
            res.setHeader(key, value);
        }
    }
    next();
};
