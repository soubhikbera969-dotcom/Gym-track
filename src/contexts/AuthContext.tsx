import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

declare global {
  interface Window {
    kinetixDesktop?: {
      isDesktop: boolean;
      localSessionToken: string;
      companyName?: string;
      appVersion?: string;
      checkForUpdates?: () => Promise<{ available: boolean; message: string }>;
    };
  }
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  isDesktopOffline: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const desktopBridge = typeof window !== 'undefined' ? window.kinetixDesktop : undefined;
  const isDesktopOffline = Boolean(desktopBridge?.isDesktop && desktopBridge?.localSessionToken);

  const [user, setUser] = useState<User | null>(() =>
    isDesktopOffline
      ? ({
          uid: 'local-company',
          displayName: desktopBridge?.companyName || 'Local Club',
          email: 'club@localhost',
        } as unknown as User)
      : null
  );
  const [loading, setLoading] = useState(!isDesktopOffline);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (isDesktopOffline) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsub();
  }, [isDesktopOffline]);

  const signInWithGoogle = useCallback(async () => {
    if (isDesktopOffline) return;
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to sign in with Google right now.';
      setAuthError(message);
    } finally {
      setSigningIn(false);
    }
  }, [isDesktopOffline]);

  const logout = useCallback(async () => {
    if (isDesktopOffline) return;
    await signOut(auth);
  }, [isDesktopOffline]);

  const apiFetch = useCallback(
    async <T = unknown>(url: string, options: RequestInit = {}): Promise<T> => {
      const headers = new Headers(options.headers || {});
      if (isDesktopOffline && desktopBridge?.localSessionToken) {
        headers.set('X-Kinetix-Local-Token', desktopBridge.localSessionToken);
      } else {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('Authentication required.');
        }
        const token = await currentUser.getIdToken();
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
      }
      return data as T;
    },
    [desktopBridge, isDesktopOffline]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signingIn,
        authError,
        isDesktopOffline,
        signInWithGoogle,
        logout,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
