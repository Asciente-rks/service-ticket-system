import { Request, Response, NextFunction } from 'express';

type Bucket = number[];
const BUCKETS: Map<string, Bucket> = new Map();

export interface RateLimitOptions {
    limit: number;
    windowMs: number;
    bucketKey: string;
}

const getClientIp = (req: Request): string => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const first = String(forwarded).split(',')[0].trim();
        if (first) return first;
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
};

export const rateLimit = (opts: RateLimitOptions) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const ip = getClientIp(req);
        const key = `${opts.bucketKey}:${ip}`;
        const now = Date.now();
        const bucket = BUCKETS.get(key) || [];

        while (bucket.length && bucket[0] < now - opts.windowMs) {
            bucket.shift();
        }

        if (bucket.length >= opts.limit) {
            const retryAfter = Math.max(
                1,
                Math.ceil((bucket[0] + opts.windowMs - now) / 1000),
            );
            res.set('Retry-After', String(retryAfter));
            res.set('X-RateLimit-Limit', String(opts.limit));
            res.set('X-RateLimit-Remaining', '0');
            return res.status(429).json({
                message: 'Too many requests. Please slow down.',
            });
        }

        bucket.push(now);
        BUCKETS.set(key, bucket);
        next();
    };
};

export const loginLimiter = rateLimit({
    limit: 5,
    windowMs: 60_000,
    bucketKey: 'auth-login',
});

export const globalLimiter = rateLimit({
    limit: 120,
    windowMs: 60_000,
    bucketKey: 'global',
});
