'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabaseClient';

export default function AuthDebugPage() {
  const supabase = createClient();
  const [result, setResult] = React.useState<string>('Nothing yet');

  async function handleCheck() {
    try {
      const { data, error } = await supabase.auth.getUser();
      setResult(
        JSON.stringify(
          {
            data,
            error: error ? { message: error.message, name: error.name } : null,
          },
          null,
          2
        )
      );
    } catch (e: any) {
      setResult('Threw error: ' + (e?.message ?? String(e)));
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-bold">Auth Debug</h1>

      <p className="mt-2 text-sm">
        1) Log in on your normal login page as <code>teacher@test.com</code>.<br />
        2) Then open <code>/auth-debug</code> in the browser.<br />
        3) Click the button below.
      </p>

      <button
        onClick={handleCheck}
        className="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
      >
        Check supabase.auth.getUser()
      </button>

      <pre className="mt-4 rounded bg-slate-50 p-3 text-xs whitespace-pre-wrap">
        {result}
      </pre>
    </div>
  );
}
