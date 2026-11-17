import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { isOfflineStorageActive } from '../db/repo.ts';

export interface AuthRequest extends Request {
  user?: Partial<DecodedIdToken> & { uid: string; email?: string; name?: string };
}

function timingSafeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (isOfflineStorageActive()) {
    const expectedToken = process.env.KINETIX_LOCAL_TOKEN?.trim();
    const providedToken = req.header('x-kinetix-local-token')?.trim() || '';
    if (!expectedToken || !providedToken || !timingSafeMatch(expectedToken, providedToken)) {
      return res.status(401).json({ error: 'Unauthorized: Invalid local desktop session.' });
    }
    req.user = {
      uid: 'local-company',
      email: 'club@localhost',
      name: process.env.KINETIX_COMPANY_NAME?.trim() || 'Club Operator',
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
