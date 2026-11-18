import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOfflineProfileById } from '../db/offlineStore.ts';
import { isOfflineStorageActive } from '../db/repo.ts';

export interface AuthRequest extends Request {
  user?: Partial<DecodedIdToken> & {
    uid: string;
    email?: string;
    name?: string;
    phone_number?: string;
    profileNumId?: number;
    provider?: 'google' | 'phone' | 'microsoft';
  };
}

function timingSafeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export const requireLocalDesktopToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!isOfflineStorageActive()) {
    return res.status(404).json({ error: 'Offline profiles are only enabled in desktop offline mode.' });
  }
  const expectedToken = process.env.KINETIX_LOCAL_TOKEN?.trim();
  const providedToken = req.header('x-kinetix-local-token')?.trim() || '';
  if (!expectedToken || !providedToken || !timingSafeMatch(expectedToken, providedToken)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid local desktop session.' });
  }
  return next();
};

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

    const profileId = req.header('x-kinetix-profile-id')?.trim() || '';
    if (!profileId) {
      return res.status(401).json({ error: 'Unauthorized: Please select or sign into a profile.' });
    }

    const profile = await getOfflineProfileById(profileId);
    if (!profile) {
      return res.status(401).json({ error: 'Unauthorized: Profile not found on this device.' });
    }

    req.user = {
      uid: profile.profileId,
      email: profile.identifier,
      name: profile.displayName,
      profileNumId: profile.numericId,
      provider: profile.provider,
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
