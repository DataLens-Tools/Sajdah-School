'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabaseClient';

type SessionStatus =
  | 'scheduled'
  | 'live'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | string;

interface SessionRow {
  id: string;
  start_utc: string;
  end_utc: string;
  status: SessionStatus;
  student_name: string;
  student_id: string;
}

export default function TeacherDashboardPage() {
  const supabase = createClient();

  const [profile, setProfile] = React.useState<any>(null);
  const [sessions, setSessions] = React.useState<SessionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // assessment modal state
  const [assessmentOpen, setAssessmentOpen] = React.useState(false);
  const [selectedSession, setSelectedSession] = React.useState<SessionRow | null>(null);
  const [rating, setRating] = React.useState<number | null>(null);
  const [notes, setNotes] = React.useState('');
  const [savingAssessment, setSavingAssessment] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) who is logged in
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) {
          setError('Not logged in.');
          setLoading(false);
          return;
        }
        const uid = user.id;

        // 2) teacher profile
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .single();
        if (profErr) throw profErr;
        setProfile(prof);

        // 3) class sessions for this teacher
        const { data: sess, error: sessErr } = await supabase
          .from('class_sessions')
          .select(
            `
            id,
            teacher_id,
            student_id,
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
            student_id: row.student_id,
          })) ?? [];

        setSessions(mapped);
        setLoading(false);
      } catch (e: any) {
        console.error('Teacher dashboard error:', e);
        setError(e.message ?? 'Unknown error');
        setLoading(false);
      }
    })();
  }, [supabase]);

  function formatTimeRange(startIso: string, endIso: string) {
    const s = new Date(startIso);
    const e = new Date(endIso);
    return `${s.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })} – ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  // ---- Start / End handlers ----

  async function handleStart(sessionId: string) {
    try {
      // optimistic update
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, status: 'live' } : s
        )
      );

      const { error } = await supabase
        .from('class_sessions')
        .update({ status: 'live' })
        .eq('id', sessionId);

      if (error) {
        throw error;
      }

      // TODO later:
      // - send Zoom link email / WhatsApp to student
      // - notify admin via separate table / webhook
    } catch (e: any) {
      console.error('start class error:', e);
      setError(e.message ?? 'Failed to start class');
      // revert optimistic update if needed
    }
  }

  async function handleEnd(sessionId: string) {
    try {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, status: 'completed' } : s
        )
      );

      const { error } = await supabase
        .from('class_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);

      if (error) {
        throw error;
      }
    } catch (e: any) {
      console.error('end class error:', e);
      setError(e.message ?? 'Failed to end class');
    }
  }

  // ---- Assessment modal ----

  function openAssessment(session: SessionRow) {
    setSelectedSession(session);
    setRating(null);
    setNotes('');
    setAssessmentOpen(true);
  }

  async function saveAssessment() {
    if (!selectedSession || !profile) return;
    try {
      setSavingAssessment(true);
      setError(null);

      const { error } = await supabase.from('assessments').insert({
        class_session_id: selectedSession.id,
        teacher_id: profile.id,
        student_id: selectedSession.student_id,
        rating,
        notes,
      });

      if (error) throw error;

      setAssessmentOpen(false);
    } catch (e: any) {
      console.error('save assessment error:', e);
      setError(e.message ?? 'Failed to save assessment');
    } finally {
      setSavingAssessment(false);
    }
  }

  // Badge helper
  function statusBadge(status: SessionStatus) {
    const base =
      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide';
    if (status === 'live') {
      return (
        <span className={`${base} bg-emerald-100 text-emerald-700`}>
          ● Live now
        </span>
      );
    }
    if (status === 'completed') {
      return (
        <span className={`${base} bg-slate-100 text-slate-700`}>
          Completed
        </span>
      );
    }
    if (status === 'scheduled') {
      return (
        <span className={`${base} bg-blue-100 text-blue-700`}>
          Scheduled
        </span>
      );
    }
    return (
      <span className={`${base} bg-slate-100 text-slate-500`}>{status}</span>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Teacher Dashboard</h1>

      {profile && (
        <p className="mt-1 text-sm text-slate-500">
          Logged in as{' '}
          <span className="font-semibold">
            {profile.full_name || 'Teacher'}
          </span>{' '}
          ({profile.role})
        </p>
      )}

      {loading && (
        <p className="mt-4 text-sm text-slate-500">Loading schedule…</p>
      )}

      {error && !loading && (
        <p className="mt-4 text-sm text-rose-600">Error: {error}</p>
      )}

      {!loading && !error && sessions.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">
          No classes scheduled yet.
        </p>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Upcoming &amp; Recent Classes
          </h2>

          <div className="mt-4 divide-y divide-slate-100">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {s.student_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatTimeRange(s.start_utc, s.end_utc)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {statusBadge(s.status)}

                  {s.status === 'scheduled' && (
                    <button
                      onClick={() => handleStart(s.id)}
                      className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Start class
                    </button>
                  )}

                  {s.status === 'live' && (
                    <button
                      onClick={() => handleEnd(s.id)}
                      className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      End class
                    </button>
                  )}

                  <button
                    onClick={() => openAssessment(s)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Assessment
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Simple assessment modal */}
      {assessmentOpen && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Assessment – {selectedSession.student_name}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {formatTimeRange(
                selectedSession.start_utc,
                selectedSession.end_utc
              )}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Rating (1–5)
                </label>
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold ${
                        rating === n
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-200 text-slate-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">
                  Notes / feedback
                </label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Memorisation, tajweed, behaviour, homework, etc."
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setAssessmentOpen(false)}
                disabled={savingAssessment}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                onClick={saveAssessment}
                disabled={savingAssessment}
              >
                {savingAssessment ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
