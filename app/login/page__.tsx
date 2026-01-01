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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setErr(error.message);

      // optional: fetch profile to confirm role
      const { data: profile } = await supabase.from('profiles').select('role').single();
      const effectiveRole = (profile?.role ?? role) as Role;

      // route by role
      if (effectiveRole === 'admin') router.push('/admin');
      else if (effectiveRole === 'teacher') router.push('/teacher');
      else router.push('/dashboard');
    } catch (e: any) {
      setErr(e?.message ?? 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-3xl font-bold">Login</h1>
      <p className="mt-2 text-slate-300">
        Logging in as <b>{role}</b>
      </p>

      <form onSubmit={onLogin} className="mt-6 grid gap-3">
        <input
          className="border border-white/10 bg-slate-900 rounded p-2"
          placeholder="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          className="border border-white/10 bg-slate-900 rounded p-2"
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <button
          className="rounded bg-sky-600 hover:bg-sky-500 text-white py-2 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
