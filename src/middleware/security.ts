import type { NextFunction, Request, Response } from 'express';

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  next();
}

interface RateBucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message: string;
}) {
  const buckets = new Map<string, RateBucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const authUser = (req as Request & { user?: { uid?: string } }).user?.uid;
    const key = authUser || req.ip || 'local';
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      if (buckets.size > 1000) {
        for (const [k, b] of buckets.entries()) {
          if (b.resetAt <= now) buckets.delete(k);
        }
      }
      return next();
    }

    if (existing.count >= options.maxRequests) {
      return res.status(429).json({ error: options.message });
    }

    existing.count += 1;
    return next();
  };
}

export const agentRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  message: 'You are sending messages very quickly. Please wait a few seconds and try again.',
});

export const writeRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 120,
  message: 'Too many updates at once. Please pause for a moment and try again.',
});

export function sanitizePlainText(value: unknown, maxLength = 4000): string {
  if (typeof value !== 'string') return '';
  // Remove null bytes and unsafe control characters while preserving tabs/newlines
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, maxLength).trim();
}
