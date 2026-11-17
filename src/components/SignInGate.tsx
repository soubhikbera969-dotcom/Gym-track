import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { DeviceProfile, useAuth } from '../contexts/AuthContext';

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'KM'
  );
}

export const SignInGate: React.FC = () => {
  const {
    signInWithGoogle,
    loginOfflineProfile,
    unlockOfflineProfile,
    removeSavedProfile,
    deviceProfiles,
    isDesktopOffline,
    signingIn,
    authError,
    clearAuthError,
  } = useAuth();

  const [showAddForm, setShowAddForm] = useState(deviceProfiles.length === 0);
  const [offlineEmail, setOfflineEmail] = useState('');
  const [offlineDisplayName, setOfflineDisplayName] = useState('');
  const [offlinePin, setOfflinePin] = useState('');

  const [unlockingProfileId, setUnlockingProfileId] = useState<string | null>(null);
  const [unlockPin, setUnlockPin] = useState('');

  const handleSelectSavedProfile = async (profile: DeviceProfile) => {
    clearAuthError();
    if (isDesktopOffline) {
      if (profile.hasPin) {
        setUnlockingProfileId(profile.id);
        setUnlockPin('');
        return;
      }
      await unlockOfflineProfile(profile.id);
      return;
    }

    await signInWithGoogle(profile.identifier);
  };

  const handleUnlockSubmit = async (e: React.FormEvent, profileId: string) => {
    e.preventDefault();
    await unlockOfflineProfile(profileId, unlockPin);
  };

  const handleOfflineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginOfflineProfile({
      identifier: offlineEmail,
      displayName: offlineDisplayName,
      pin: offlinePin,
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)] space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#059669] text-white flex items-center justify-center shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-[-0.02em] text-[#0F172A]">
              Kinetix
            </h1>
            <p className="text-xs font-medium text-[#64748B]">
              Athletic Operations &amp; Studio Command Center
            </p>
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-[#0F172A]">
            Sign In with Gmail
          </h2>
          <p className="mt-1 text-sm text-[#475569] leading-relaxed">
            Each Gmail profile keeps its own members, leads, billing, and studio schedule stored separately on this {isDesktopOffline ? 'computer' : 'account'}.
          </p>
        </div>

        {authError && (
          <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]">
            {authError}
          </div>
        )}

        {/* Saved Gmail Profiles on This Desktop / Device */}
        {deviceProfiles.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                Saved Profiles on This Device
              </span>
              {!showAddForm && (
                <button
                  type="button"
                  onClick={() => {
                    clearAuthError();
                    setShowAddForm(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#059669] hover:text-[#047857] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Gmail Profile
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
              {deviceProfiles.map((profile) => {
                const isUnlocking = unlockingProfileId === profile.id;
                return (
                  <div
                    key={profile.id}
                    className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 transition-colors hover:border-[#CBD5E1]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        disabled={signingIn}
                        onClick={() => void handleSelectSavedProfile(profile)}
                        className="flex-1 flex items-center gap-3 text-left min-w-0 cursor-pointer disabled:opacity-60"
                      >
                        <div className="h-9 w-9 rounded-lg bg-[#059669]/12 text-[#047857] font-bold text-xs flex items-center justify-center shrink-0">
                          {getInitials(profile.displayName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-[#0F172A] truncate">
                              {profile.displayName}
                            </span>
                            {profile.hasPin && (
                              <Lock className="h-3 w-3 text-[#64748B] shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-[#64748B] truncate">
                            {profile.identifier}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-[#64748B] shrink-0" />
                      </button>

                      {!isDesktopOffline && (
                        <button
                          type="button"
                          onClick={() => removeSavedProfile(profile.id)}
                          aria-label={`Remove ${profile.displayName} shortcut`}
                          title="Remove profile shortcut"
                          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#DC2626] hover:bg-white cursor-pointer shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {isUnlocking && (
                      <form
                        onSubmit={(e) => void handleUnlockSubmit(e, profile.id)}
                        className="mt-3 pt-3 border-t border-[#E2E8F0] flex items-center gap-2"
                      >
                        <input
                          type="password"
                          autoFocus
                          value={unlockPin}
                          onChange={(e) => setUnlockPin(e.target.value)}
                          placeholder="Enter profile passcode"
                          className="flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:border-[#059669]"
                        />
                        <button
                          type="submit"
                          disabled={signingIn || !unlockPin}
                          className="rounded-lg bg-[#059669] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#047857] disabled:opacity-60 cursor-pointer"
                        >
                          Unlock
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Gmail Sign-In / Add Profile */}
        {(showAddForm || deviceProfiles.length === 0) && (
          <div className="space-y-4 pt-2 border-t border-[#F1F5F9]">
            {deviceProfiles.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B]">
                  Sign In to Another Gmail Profile
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs font-medium text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                >
                  Hide
                </button>
              </div>
            )}

            {!isDesktopOffline ? (
              <button
                type="button"
                onClick={() => void signInWithGoogle()}
                disabled={signingIn}
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-lg bg-[#059669] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-60 transition-colors cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4" />
                {signingIn ? 'Connecting Gmail...' : 'Continue with Gmail / Google'}
              </button>
            ) : (
              <form onSubmit={(e) => void handleOfflineSubmit(e)} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1">
                    Gmail / Google Address
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={offlineEmail}
                      onChange={(e) => setOfflineEmail(e.target.value)}
                      placeholder="name@gmail.com"
                      className="w-full rounded-lg border border-[#E2E8F0] pl-9 pr-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#059669]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1">
                      Profile Name
                    </label>
                    <input
                      type="text"
                      value={offlineDisplayName}
                      onChange={(e) => setOfflineDisplayName(e.target.value)}
                      placeholder="e.g. Coach Maya"
                      className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#059669]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.05em] text-[#64748B] mb-1">
                      Passcode (optional)
                    </label>
                    <input
                      type="password"
                      value={offlinePin}
                      onChange={(e) => setOfflinePin(e.target.value)}
                      placeholder="4+ chars to lock"
                      className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm text-[#0F172A] focus:outline-none focus:border-[#059669]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={signingIn}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#059669] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-60 cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {signingIn ? 'Opening Encrypted Profile...' : 'Open Gmail Profile'}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-[#F1F5F9] grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
            <div className="text-[11px] font-bold text-[#0F172A]">Isolated</div>
            <div className="text-[10px] text-[#64748B]">Per-User Data</div>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
            <div className="text-[11px] font-bold text-[#0F172A]">Multi-Profile</div>
            <div className="text-[10px] text-[#64748B]">Gmail Switcher</div>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
            <div className="text-[11px] font-bold text-[#0F172A]">Encrypted</div>
            <div className="text-[10px] text-[#64748B]">Private Workspace</div>
          </div>
        </div>
      </div>
    </div>
  );
};
