'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabaseClient';

type SessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled' | 'no_show' | string;

interface SessionRow {
  id: string;
  start_utc: string;
  end_utc: string;
  status: SessionStatus;
  student_name: string;
}

export default function TeacherDashboardPage() {
  const supabase = createClient();

  const [userInfo, setUserInfo] = React.useState<any>(null);
  const [profile, setProfile] = React.useState<any>(null);
  const [sessions, setSessions] = React.useState<SessionRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // STEP 1 – who is logged in?
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        setUserInfo(user);

        if (!user) {
          setError('Not logged in.');
          setLoading(false);
          return;
        }

        const uid = user.id;

        // STEP 2 – profile for this uid
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .single();

        if (profErr) throw profErr;
        setProfile(prof);

        // STEP 3 – class_sessions for this teacher
        const { data: sess, error: sessErr } = await supabase
          .from('class_sessions')
          .select(
            `
            id,
            start_utc,
            end_utc,
            status,
            student:student_id (
              full_name
            )
          `
          )
          .eq('teacher_id', uid)
          .order('start_utc', { ascending: true });

        if (sessErr) throw sessErr;

        const mapped: SessionRow[] =
          (sess ?? []).map((row: any) => ({
            id: row.id,
            start_utc: row.start_utc,
            end_utc: row.end_utc,
            status: row.status,
            student_name: row.student?.full_name ?? 'Student',
          })) ?? [];

        setSessions(mapped);
        setLoading(false);
      } catch (e: any) {
        console.error('Teacher dashboard error:', e);
        setError(e.message ?? 'Unknown error');
        setLoading(false);
      }
    })();
    // run once on mount
  }, []);

  function formatTimeRange(startIso: string, endIso: string) {
    const s = new Date(startIso);
    const e = new Date(endIso);
    return `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Teacher Dashboard (debug)</h1>

      {loading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
      {error && (
        <p className="mt-4 text-sm text-rose-600">
          Error: {error}
        </p>
      )}

      <h2 className="mt-6 text-sm font-semibold">STEP 1 – auth user</h2>
      <pre className="mt-1 rounded bg-slate-50 p-3 text-xs whitespace-pre-wrap">
        {userInfo ? JSON.stringify({ id: userInfo.id, email: userInfo.email }, null, 2) : 'user = null'}
      </pre>

      <h2 className="mt-6 text-sm font-semibold">STEP 2 – profile row</h2>
      <pre className="mt-1 rounded bg-slate-50 p-3 text-xs whitespace-pre-wrap">
        {profile ? JSON.stringify({ id: profile.id, role: profile.role }, null, 2) : 'profile = null'}
      </pre>

      <h2 className="mt-6 text-sm font-semibold">STEP 3 – class_sessions for this teacher</h2>
      <pre className="mt-1 rounded bg-slate-50 p-3 text-xs whitespace-pre-wrap">
        {sessions === null
          ? 'sessions = null (still loading or error)'
          : JSON.stringify(sessions, null, 2)}
      </pre>

      {!loading && !error && sessions && sessions.length > 0 && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">
            Upcoming &amp; Recent Classes
          </h3>

          <div className="mt-4 divide-y divide-slate-100">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {s.student_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatTimeRange(s.start_utc, s.end_utc)}
                  </p>
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
                  {s.status}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

