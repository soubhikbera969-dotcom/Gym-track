import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export interface DeviceProfile {
  id: string;
  provider: 'google';
  identifier: string;
  displayName: string;
  hasPin?: boolean;
  lastActiveAt: string;
}

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
  deviceProfiles: DeviceProfile[];
  clearAuthError: () => void;
  signInWithGoogle: (loginHint?: string) => Promise<void>;
  loginOfflineProfile: (input: {
    identifier: string;
    displayName?: string;
    pin?: string;
  }) => Promise<void>;
  unlockOfflineProfile: (profileId: string, pin?: string) => Promise<void>;
  removeSavedProfile: (profileId: string) => void;
  logout: () => Promise<void>;
  apiFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
}

const DEVICE_PROFILES_STORAGE_KEY = 'kinetix_device_profiles_v1';
const OFFLINE_ACTIVE_PROFILE_KEY = 'kinetix_active_offline_profile_v1';

const AuthContext = createContext<AuthContextValue | null>(null);

function readSavedCloudProfiles(): DeviceProfile[] {
  try {
    const raw = localStorage.getItem(DEVICE_PROFILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeviceProfile[];
    return Array.isArray(parsed)
      ? parsed.filter((p) => p && p.provider === 'google' && p.identifier)
      : [];
  } catch {
    return [];
  }
}

function writeSavedCloudProfiles(list: DeviceProfile[]) {
  try {
    localStorage.setItem(DEVICE_PROFILES_STORAGE_KEY, JSON.stringify(list.slice(0, 12)));
  } catch {
    // Ignore storage quota errors
  }
}

function toOfflineUser(profile: DeviceProfile): User {
  return {
    uid: profile.id,
    displayName: profile.displayName,
    email: profile.identifier,
    phoneNumber: null,
  } as unknown as User;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const desktopBridge = typeof window !== 'undefined' ? window.kinetixDesktop : undefined;
  const isDesktopOffline = Boolean(desktopBridge?.isDesktop && desktopBridge?.localSessionToken);

  const [user, setUser] = useState<User | null>(() => {
    if (!isDesktopOffline) return null;
    try {
      const saved = sessionStorage.getItem(OFFLINE_ACTIVE_PROFILE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as DeviceProfile;
        if (parsed?.id) return toOfflineUser(parsed);
      }
    } catch {
      // Ignore sessionStorage errors
    }
    return null;
  });

  const [activeOfflineProfile, setActiveOfflineProfile] = useState<DeviceProfile | null>(() => {
    if (!isDesktopOffline) return null;
    try {
      const saved = sessionStorage.getItem(OFFLINE_ACTIVE_PROFILE_KEY);
      return saved ? (JSON.parse(saved) as DeviceProfile) : null;
    } catch {
      return null;
    }
  });

  const [deviceProfiles, setDeviceProfiles] = useState<DeviceProfile[]>(() =>
    isDesktopOffline ? [] : readSavedCloudProfiles()
  );
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const refreshOfflineProfiles = useCallback(async () => {
    if (!isDesktopOffline || !desktopBridge?.localSessionToken) return;
    try {
      const res = await fetch('/api/offline/profiles', {
        headers: {
          'X-Kinetix-Local-Token': desktopBridge.localSessionToken,
        },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        profiles?: Array<{
          profileId: string;
          provider: 'google' | 'phone' | 'microsoft';
          identifier: string;
          displayName: string;
          hasPin: boolean;
          lastActiveAt: string;
        }>;
      };
      const mapped: DeviceProfile[] = (data.profiles || []).map((p) => ({
        id: p.profileId,
        provider: 'google',
        identifier: p.identifier,
        displayName: p.displayName,
        hasPin: p.hasPin,
        lastActiveAt: p.lastActiveAt,
      }));
      setDeviceProfiles(mapped);
    } catch {
      // Ignore transient startup error
    }
  }, [desktopBridge, isDesktopOffline]);

  useEffect(() => {
    if (isDesktopOffline) {
      void refreshOfflineProfiles().finally(() => setLoading(false));
      return;
    }

    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const identifier = firebaseUser.email || firebaseUser.uid;
        const displayName =
          firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Club Operator';
        const entry: DeviceProfile = {
          id: firebaseUser.uid,
          provider: 'google',
          identifier,
          displayName,
          lastActiveAt: new Date().toISOString(),
        };
        setDeviceProfiles((prev) => {
          const next = [entry, ...prev.filter((p) => p.id !== entry.id)];
          writeSavedCloudProfiles(next);
          return next;
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [isDesktopOffline, refreshOfflineProfiles]);

  const signInWithGoogle = useCallback(
    async (loginHint?: string) => {
      if (isDesktopOffline) return;
      setAuthError(null);
      setSigningIn(true);
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters(
          loginHint
            ? { prompt: 'select_account', login_hint: loginHint }
            : { prompt: 'select_account' }
        );
        await signInWithPopup(auth, provider);
      } catch (err) {
        const code = (err as { code?: string } | null)?.code || '';
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          setAuthError('Google sign-in window was closed before completing.');
        } else {
          setAuthError(
            err instanceof Error ? err.message : 'Unable to sign in with Google right now.'
          );
        }
      } finally {
        setSigningIn(false);
      }
    },
    [isDesktopOffline]
  );

  const activateOfflineProfile = useCallback((profile: DeviceProfile) => {
    setActiveOfflineProfile(profile);
    setUser(toOfflineUser(profile));
    try {
      sessionStorage.setItem(OFFLINE_ACTIVE_PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore sessionStorage failures
    }
  }, []);

  const loginOfflineProfile = useCallback(
    async (input: { identifier: string; displayName?: string; pin?: string }) => {
      if (!isDesktopOffline || !desktopBridge?.localSessionToken) return;
      setAuthError(null);
      setSigningIn(true);
      try {
        const res = await fetch('/api/offline/profiles/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Kinetix-Local-Token': desktopBridge.localSessionToken,
          },
          body: JSON.stringify({
            provider: 'google',
            identifier: input.identifier,
            displayName: input.displayName,
            pin: input.pin,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          profile?: {
            profileId: string;
            identifier: string;
            displayName: string;
            hasPin: boolean;
            lastActiveAt: string;
          };
        };
        if (!res.ok || !data.profile) {
          throw new Error(data.error || 'Unable to open Gmail profile.');
        }
        const profile: DeviceProfile = {
          id: data.profile.profileId,
          provider: 'google',
          identifier: data.profile.identifier,
          displayName: data.profile.displayName,
          hasPin: data.profile.hasPin,
          lastActiveAt: data.profile.lastActiveAt,
        };
        activateOfflineProfile(profile);
        await refreshOfflineProfiles();
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Unable to open Gmail profile.');
      } finally {
        setSigningIn(false);
      }
    },
    [activateOfflineProfile, desktopBridge, isDesktopOffline, refreshOfflineProfiles]
  );

  const unlockOfflineProfile = useCallback(
    async (profileId: string, pin?: string) => {
      if (!isDesktopOffline || !desktopBridge?.localSessionToken) return;
      setAuthError(null);
      setSigningIn(true);
      try {
        const res = await fetch('/api/offline/profiles/switch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Kinetix-Local-Token': desktopBridge.localSessionToken,
          },
          body: JSON.stringify({ profileId, pin }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          profile?: {
            profileId: string;
            identifier: string;
            displayName: string;
            hasPin: boolean;
            lastActiveAt: string;
          };
        };
        if (!res.ok || !data.profile) {
          throw new Error(data.error || 'Unable to unlock profile.');
        }
        const profile: DeviceProfile = {
          id: data.profile.profileId,
          provider: 'google',
          identifier: data.profile.identifier,
          displayName: data.profile.displayName,
          hasPin: data.profile.hasPin,
          lastActiveAt: data.profile.lastActiveAt,
        };
        activateOfflineProfile(profile);
        await refreshOfflineProfiles();
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Unable to unlock profile.');
      } finally {
        setSigningIn(false);
      }
    },
    [activateOfflineProfile, desktopBridge, isDesktopOffline, refreshOfflineProfiles]
  );

  const removeSavedProfile = useCallback(
    (profileId: string) => {
      if (isDesktopOffline) return;
      setDeviceProfiles((prev) => {
        const next = prev.filter((p) => p.id !== profileId);
        writeSavedCloudProfiles(next);
        return next;
      });
    },
    [isDesktopOffline]
  );

  const logout = useCallback(async () => {
    setAuthError(null);
    if (isDesktopOffline) {
      setActiveOfflineProfile(null);
      setUser(null);
      try {
        sessionStorage.removeItem(OFFLINE_ACTIVE_PROFILE_KEY);
      } catch {
        // Ignore
      }
      await refreshOfflineProfiles();
      return;
    }
    await signOut(auth);
  }, [isDesktopOffline, refreshOfflineProfiles]);

  const apiFetch = useCallback(
    async <T = unknown>(url: string, options: RequestInit = {}): Promise<T> => {
      const headers = new Headers(options.headers || {});
      if (isDesktopOffline) {
        if (!desktopBridge?.localSessionToken || !activeOfflineProfile?.id) {
          throw new Error('Please select or sign into a profile.');
        }
        headers.set('X-Kinetix-Local-Token', desktopBridge.localSessionToken);
        headers.set('X-Kinetix-Profile-Id', activeOfflineProfile.id);
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
    [activeOfflineProfile, desktopBridge, isDesktopOffline]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signingIn,
        authError,
        isDesktopOffline,
        deviceProfiles,
        clearAuthError,
        signInWithGoogle,
        loginOfflineProfile,
        unlockOfflineProfile,
        removeSavedProfile,
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
