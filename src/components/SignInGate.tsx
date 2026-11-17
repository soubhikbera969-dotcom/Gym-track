import React from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const SignInGate: React.FC = () => {
  const { signInWithGoogle, signingIn, authError } = useAuth();

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-3 mb-6">
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

        <h2 className="font-display text-lg font-semibold text-[#0F172A]">
          Operator Sign-In
        </h2>
        <p className="mt-1.5 text-sm text-[#475569] leading-relaxed">
          Sign in with your Google workspace account to access your gym CRM, automated member communications, 3D floor telemetry, and AI operations agent.
        </p>

        {authError && (
          <div className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]">
            {authError}
          </div>
        )}

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={signingIn}
          className="mt-6 w-full inline-flex items-center justify-center gap-2.5 rounded-lg bg-[#059669] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#047857] disabled:opacity-60 transition-colors cursor-pointer"
        >
          <ShieldCheck className="h-4 w-4" />
          {signingIn ? 'Connecting Account...' : 'Sign in with Google'}
        </button>

        <div className="mt-6 pt-5 border-t border-[#F1F5F9] grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
            <div className="text-[11px] font-bold text-[#0F172A]">CRM</div>
            <div className="text-[10px] text-[#64748B]">Members &amp; Leads</div>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
            <div className="text-[11px] font-bold text-[#0F172A]">Reminders</div>
            <div className="text-[10px] text-[#64748B]">Auto Alerts</div>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] px-2 py-2">
            <div className="text-[11px] font-bold text-[#0F172A]">AI Agent</div>
            <div className="text-[10px] text-[#64748B]">Query &amp; Push</div>
          </div>
        </div>
      </div>
    </div>
  );
};
