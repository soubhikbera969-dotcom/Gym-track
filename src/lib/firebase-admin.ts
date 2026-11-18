import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function resolveFirebaseProjectId(): string | undefined {
  if (process.env.FIREBASE_PROJECT_ID?.trim()) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  const currentDir =
    typeof __dirname !== 'undefined'
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(currentDir, '..', 'firebase-applet-config.json'),
    path.resolve(currentDir, '..', '..', 'firebase-applet-config.json'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
          projectId?: string;
        };
        if (parsed.projectId) return parsed.projectId;
      }
    } catch {
      // Ignore malformed config file
    }
  }
  return undefined;
}

if (!getApps().length) {
  const projectId = resolveFirebaseProjectId();
  initializeApp(projectId ? { projectId } : undefined);
}

export const adminAuth = getAuth();
