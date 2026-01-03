'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

type Role = 'student' | 'teacher' | 'admin';

export default function LoginPage() {
  const supabase = createClient();
  const sp = useSearchParams();
  const router = useRouter();

  const role = (sp.get('role') ?? 'student') as Role;

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function onLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);

    if (!email || !password) return setErr('Enter your email and password.');

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return setErr(error.message);
      if (!data?.user) return setErr('Login failed: no user returned.');

      // IMPORTANT: fetch the profile role for THIS user
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileErr) return setErr(profileErr.message);

      const effectiveRole = (profile?.role ?? role) as Role;

      // If we were redirected here, go back to that page after login
      const next = sp.get('next');
      if (next) {
        router.push(next);
        return;
      }

      // Default landing pages
      if (effectiveRole === 'admin') router.push('/admin');
      else if (effectiveRole === 'teacher') router.push('/teacher/dashboard');
      else router.push('/student/dashboard');
    } catch (e: any) {
      setErr(e?.message ?? 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-emerald-50/20 to-white flex items-center">
      <div className="max-w-7xl mx-auto w-full px-4">
        <div className="max-w-sm mx-auto">
          {/* Heading */}
          <div className="text-center mb-8">
            <img
              src="/assets/sajdah-logo.png"
              alt="Sajdah Qur'an School logo"
              className="mx-auto w-14 h-14 mb-3"
            />
            <h1 className="text-3xl font-extrabold text-slate-900">Login</h1>
            <p className="mt-2 text-sm text-slate-600">
              Logging in as{' '}
              <span className="font-semibold text-emerald-700">{role}</span>
            </p>
          </div>

          {/* Card */}
          <div className="rounded-3xl bg-white border border-amber-200/80 shadow-[0_18px_45px_rgba(15,23,42,0.12)] p-6 sm:p-7">
            <form onSubmit={onLogin} className="grid gap-4">
              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Email
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300"
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Password
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              {err && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {err}
                </div>
              )}

              <button
                className="mt-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white py-2.5 text-sm font-semibold shadow-[0_8px_20px_rgba(16,185,129,0.25)] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-300"
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              Switch role:&nbsp;
              <a
                href="/login?role=student"
                className="text-amber-700 hover:underline"
              >
                student
              </a>{' '}
              •{' '}
              <a
                href="/login?role=teacher"
                className="text-amber-700 hover:underline"
              >
                teacher
              </a>{' '}
              •{' '}
              <a
                href="/login?role=admin"
                className="text-amber-700 hover:underline"
              >
                admin
              </a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
