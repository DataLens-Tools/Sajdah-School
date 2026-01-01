'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { TeacherEarningsPanel } from '@/components/TeacherEarningsPanel';
import TeacherStudentChatModal from '../../../components/TeacherStudentChatModal';
import TeacherAvailabilityPanel from '@/components/TeacherAvailabilityPanel';
import TeacherAvatar from '@/components/TeacherAvatar';


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
  zoom_url: string | null;
}

export default function TeacherDashboardPage() {
  const supabase = createClient();
  const router = useRouter();

  const [profile, setProfile] = React.useState<any>(null);
  const [sessions, setSessions] = React.useState<SessionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // assessment modal
  const [assessmentOpen, setAssessmentOpen] = React.useState(false);
  const [selectedSession, setSelectedSession] =
    React.useState<SessionRow | null>(null);
  const [rating, setRating] = React.useState<number | null>(null);
  const [notes, setNotes] = React.useState('');
  const [savingAssessment, setSavingAssessment] = React.useState(false);

  // chat modal
  const [chatOpen, setChatOpen] = React.useState(false);
  const [chatStudent, setChatStudent] = React.useState<{
    id: string;
    name: string;
  } | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

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

        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .single();
        if (profErr) throw profErr;
        setProfile(prof);

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
            zoom_url,
            student:student_id (
              full_name
            )
          `,
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
            zoom_url: row.zoom_url ?? null,
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
    })} – ${e.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  // ---- Logout ----
  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login'); // adjust if your login route is different
  }

  // ---- Start / End handlers ----

  async function handleStart(session: SessionRow) {
    try {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === session.id ? { ...s, status: 'live' } : s,
        ),
      );

      const { error } = await supabase
        .from('class_sessions')
        .update({ status: 'live', started_at: new Date().toISOString() })
        .eq('id', session.id);

      if (error) throw error;

      // Open Zoom automatically if link is set
      if (session.zoom_url) {
        window.open(session.zoom_url, '_blank', 'noopener,noreferrer');
      }
    } catch (e: any) {
      console.error('start class error:', e);
      setError(e.message ?? 'Failed to start class');
    }
  }

  async function handleEnd(session: SessionRow) {
    try {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === session.id ? { ...s, status: 'completed' } : s,
        ),
      );

      const { error } = await supabase
        .from('class_sessions')
        .update({ status: 'completed', ended_at: new Date().toISOString() })
        .eq('id', session.id);

      if (error) throw error;
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
      <div className="flex items-center justify-between gap-4">
  {profile ? (
    <div className="flex items-center gap-3">
      <TeacherAvatar
        name={profile.full_name || 'Teacher'}
        gender={profile.gender as 'male' | 'female' | null}
        avatarUrl={profile.avatar_url}
        size={44}
      />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Teacher Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Logged in as{' '}
          <span className="font-semibold">
            {profile.full_name || 'Teacher'}
          </span>{' '}
          ({profile.role})
        </p>
      </div>
    </div>
  ) : (
    <h1 className="text-2xl font-bold text-slate-900">
      Teacher Dashboard
    </h1>
  )}

  <button
    onClick={handleLogout}
    className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
  >
    Logout
  </button>
</div>

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
                  {s.zoom_url && (
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          s.zoom_url as string,
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }
                      className="mt-2 inline-flex items-center rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      Open Zoom link
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {statusBadge(s.status)}

                  {s.status === 'scheduled' && (
                    <button
                      onClick={() => handleStart(s)}
                      className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Start class
                    </button>
                  )}

                  {s.status === 'live' && (
                    <button
                      onClick={() => handleEnd(s)}
                      className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      End class
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setChatStudent({ id: s.student_id, name: s.student_name });
                      setChatOpen(true);
                    }}
                    className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    Chat
                  </button>

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

      {/* Earnings Panel */}
      {profile && (
        <div className="mt-8">
          <TeacherEarningsPanel teacherId={profile.id} />
        </div>
      )}

      {profile && (
        <div className="mt-8">
          <TeacherAvailabilityPanel teacherId={profile.id} />
        </div>
      )}

      {/* Chat modal */}
      {profile && chatStudent && (
        <TeacherStudentChatModal
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          teacherId={profile.id}
          studentId={chatStudent.id}
          studentName={chatStudent.name}
        />
      )}

      {/* Assessment modal same as before */}
      {assessmentOpen && selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Assessment – {selectedSession.student_name}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {formatTimeRange(
                selectedSession.start_utc,
                selectedSession.end_utc,
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
