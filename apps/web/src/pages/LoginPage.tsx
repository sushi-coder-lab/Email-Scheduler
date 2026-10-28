import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, ShieldCheck, Zap, Server, MessageSquare, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/common/Button';
import { authApi } from '../api/auth.api';

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get('error');
  const navigate = useNavigate();
  const { loginWithDev } = useAuth();
  const [loadingDev, setLoadingDev] = useState(false);

  const handleGoogleLogin = () => {
    window.location.href = authApi.getGoogleAuthUrl();
  };

  const handleDevLogin = async () => {
    setLoadingDev(true);
    try {
      await loginWithDev('demo@reachinbox.ai');
      navigate('/dashboard');
    } finally {
      setLoadingDev(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background geometric accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Outbox Labs Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface border border-surface-border mb-4 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider text-slate-300 uppercase">
              Outbox Labs Hiring Assignment
            </span>
          </div>

          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-xl shadow-primary/30 text-white font-bold">
              <Mail className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              ReachInbox
            </h1>
          </div>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Production-grade distributed email job scheduler powered by BullMQ, Redis, PostgreSQL, and Ethereal SMTP.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface border border-surface-border rounded-3xl p-8 shadow-2xl shadow-black/80 space-y-6">
          {oauthError && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800/80 text-red-200 text-xs text-center font-medium">
              Google OAuth error: {oauthError}
            </div>
          )}

          {/* Real Google OAuth Button */}
          <div>
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all shadow-md active:scale-[0.99]"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
            <div className="text-[11px] text-slate-500 text-center mt-2">
              Official Google OAuth 2.0 flow
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-surface-border" />
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">or evaluator demo</span>
            <div className="flex-1 h-px bg-surface-border" />
          </div>

          {/* Quick Demo Login */}
          <div>
            <Button
              variant="secondary"
              onClick={handleDevLogin}
              loading={loadingDev}
              className="w-full text-xs"
              icon={<ArrowRight className="w-4 h-4 text-primary-light" />}
            >
              Sign in as Demo Operator (demo@reachinbox.ai)
            </Button>
            <div className="text-[10px] text-slate-500 text-center mt-1.5">
              Instantly issues signed session cookie without requiring external Google Cloud credentials
            </div>
          </div>

          {/* Highlights */}
          <div className="pt-4 border-t border-surface-border/60 grid grid-cols-2 gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>BullMQ & Redis 6</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>PostgreSQL 14 DB</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Distributed Rate Limit</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Slack Web API Alerts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
