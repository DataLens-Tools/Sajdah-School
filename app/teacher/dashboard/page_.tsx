'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabaseClient';

type SessionStatus = 'scheduled' | 'live' | 'completed' | 'cancelled' | 'no_show' | string;

interface SessionRow {
  id: string;
  start_utc: string;
  end_utc: string;
  status: SessionStatus;
  student_id: string | null;
  student_name: string;
}

interface AssessmentFormValues {
  tajweed_score: number | '';
  recitation_score: number | '';
  hifz_score: number | '';
  behaviour_score: number | '';
  homework_completed: boolean;
  comments: string;
}

export default function TeacherDashboardPage() {
  const supabase = createClient();

  const [userId, setUserId] = React.useState<string | null>(null);
  const [userRole, setUserRole] = React.useState<string | null>(null);

  const [sessions, setSessions] = React.useState<SessionRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [assessmentOpen, setAssessmentOpen] = React.useState(false);
  const [assessmentSessionId, setAssessmentSessionId] = React.useState<string | null>(null);
  const [assessmentStudentId, setAssessmentStudentId] = React.useState<string | null>(null);
  const [savingAssessment, setSavingAssessment] = React.useState(false);

  const [assessmentValues, setAssessmentValues] = React.useState<AssessmentFormValues>({
    tajweed_score: '',
    recitation_score: '',
    hifz_score: '',
    behaviour_score: '',
    homework_completed: false,
    comments: '',
  });

  // 1) Load current user + profile.role
  const loadUserAndProfile = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      setError('You are not logged in.');
      setLoading(false);
      return null;
    }

    const uid = userRes.user.id;
    setUserId(uid);

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .single();

    if (profileErr) {
      console.error(profileErr);
      setError('Could not load profile.');
      setLoading(false);
      return null;
    }

    setUserRole(profile.role);
    return uid;
  }, [supabase]);

  // 2) Load class_sessions for this teacher
  const loadSessions = React.useCallback(
    async (teacherId: string | null) => {
      if (!teacherId) return;
      setError(null);

      const { data, error } = await supabase
        .from('class_sessions')
        .select(
          `
          id,
          start_utc,
          end_utc,
          status,
          student:student_id (
            id,
            full_name
          )
        `
        )
        .eq('teacher_id', teacherId)
        .order('start_utc', { ascending: true });

      if (error) {
        console.error(error);
        setError('Could not load your schedule.');
        setLoading(false);
        return;
      }

      const mapped: SessionRow[] =
        (data ?? []).map((row: any) => ({
          id: row.id,
          start_utc: row.start_utc,
          end_utc: row.end_utc,
          status: row.status as SessionStatus,
          student_id: row.student?.id ?? null,
          student_name: row.student?.full_name ?? 'Student',
        })) ?? [];

      setSessions(mapped);
      setLoading(false);
    },
    [supabase]
  );

  // Initial load
  React.useEffect(() => {
    (async () => {
      const uid = await loadUserAndProfile();
      if (uid) {
        await loadSessions(uid);
      }
    })();
  }, [loadUserAndProfile, loadSessions]);

  // --- Start / End class ---

  async function handleStartClass(session: SessionRow) {
    try {
      const { error } = await supabase
        .from('class_sessions')
        .update({
          status: 'live',
          started_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      if (error) throw error;
      await loadSessions(userId);
    } catch (err) {
      console.error(err);
      alert('Could not start class.');
    }
  }

  async function handleEndClass(session: SessionRow) {
    try {
      const { error } = await supabase
        .from('class_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      if (error) throw error;
      await loadSessions(userId);

      if (session.student_id) {
        openAssessmentModal(session.id, session.student_id);
      }
    } catch (err) {
      console.error(err);
      alert('Could not end class.');
    }
  }

  // --- Assessment modal logic ---

  function openAssessmentModal(sessionId: string, studentId: string) {
    setAssessmentSessionId(sessionId);
    setAssessmentStudentId(studentId);
    setAssessmentValues({
      tajweed_score: '',
      recitation_score: '',
      hifz_score: '',
      behaviour_score: '',
      homework_completed: false,
      comments: '',
    });
    setAssessmentOpen(true);
  }

  function closeAssessmentModal() {
    setAssessmentOpen(false);
    setAssessmentSessionId(null);
    setAssessmentStudentId(null);
  }

  function updateAssessmentField<K extends keyof AssessmentFormValues>(
    field: K,
    value: AssessmentFormValues[K]
  ) {
    setAssessmentValues(prev => ({ ...prev, [field]: value }));
  }

  async function handleSaveAssessment(e: React.FormEvent) {
    e.preventDefault();
    if (!assessmentSessionId || !assessmentStudentId) return;

    const { tajweed_score, recitation_score, hifz_score, behaviour_score } =
      assessmentValues;

    if (
      tajweed_score === '' ||
      recitation_score === '' ||
      hifz_score === '' ||
      behaviour_score === ''
    ) {
      alert('Please fill all scores.');
      return;
    }

    setSavingAssessment(true);

    try {
      const { data: userRes } = await supabase.auth.getUser();
      const teacherId = userRes?.user?.id;

      const { error } = await supabase.from('assessments').insert({
        class_session_id: assessmentSessionId,
        student_id: assessmentStudentId,
        teacher_id: teacherId,
        tajweed_score: Number(tajweed_score),
        recitation_score: Number(recitation_score),
        hifz_score: Number(hifz_score),
        behaviour_score: Number(behaviour_score),
        homework_completed: assessmentValues.homework_completed,
        comments: assessmentValues.comments,
        visible_to_parents: true,
      });

      if (error) throw error;

      setSavingAssessment(false);
      closeAssessmentModal();
      alert('Assessment saved.');
    } catch (err) {
      console.error(err);
      alert('Could not save assessment.');
      setSavingAssessment(false);
    }
  }

  // --- Helpers ---

  function formatTimeRange(startIso: string, endIso: string) {
    const s = new Date(startIso);
    const e = new Date(endIso);
    return `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  function statusBadge(status: SessionStatus) {
    const base =
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';
    if (status === 'scheduled')
      return <span className={`${base} bg-slate-100 text-slate-700`}>Scheduled</span>;
    if (status === 'live')
      return <span className={`${base} bg-emerald-100 text-emerald-800`}>● Live</span>;
    if (status === 'completed')
      return <span className={`${base} bg-blue-100 text-blue-800`}>Completed</span>;
    if (status === 'cancelled')
      return <span className={`${base} bg-rose-100 text-rose-800`}>Cancelled</span>;
    if (status === 'no_show')
      return <span className={`${base} bg-amber-100 text-amber-800`}>No show</span>;
    return <span className={base}>{status}</span>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Teacher Dashboard</h1>

      {/* Small debug header so we never see just "null" */}
      <div className="mt-3 rounded-lg bg-slate-50 px-4 py-2 text-xs text-slate-600">
        <div>User ID: {userId ?? 'not loaded'}</div>
        <div>Role: {userRole ?? 'unknown'}</div>
      </div>

      {userRole && userRole !== 'teacher' && (
        <p className="mt-4 text-sm text-amber-700">
          You are logged in as <strong>{userRole}</strong>. This page is meant
          for teachers. (Later we can redirect students/admins.)
        </p>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Upcoming &amp; Recent Classes
          </h2>
          <button
            onClick={() => loadSessions(userId)}
            className="text-xs font-medium text-emerald-700 underline"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <p className="mt-4 text-sm text-slate-500">Loading schedule…</p>
        )}

        {error && !loading && (
          <p className="mt-4 text-sm text-rose-600">{error}</p>
        )}

        {!loading && !error && sessions.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">
            No classes found yet. Once the admin creates class_sessions for you,
            they will appear here.
          </p>
        )}

        {!loading && !error && sessions.length > 0 && (
          <div className="mt-4 divide-y divide-slate-100">
            {sessions.map(session => (
              <div
                key={session.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {session.student_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatTimeRange(session.start_utc, session.end_utc)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {statusBadge(session.status)}

                  {session.status === 'scheduled' && (
                    <button
                      onClick={() => handleStartClass(session)}
                      className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Start class
                    </button>
                  )}

                  {session.status === 'live' && (
                    <button
                      onClick={() => handleEndClass(session)}
                      className="rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      End class
                    </button>
                  )}

                  {session.status === 'completed' && session.student_id && (
                    <button
                      onClick={() =>
                        openAssessmentModal(session.id, session.student_id!)
                      }
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Add / edit assessment
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {assessmentOpen && (
        <AssessmentModal
          values={assessmentValues}
          saving={savingAssessment}
          onChange={updateAssessmentField}
          onClose={closeAssessmentModal}
          onSubmit={handleSaveAssessment}
        />
      )}
    </div>
  );
}

/* -------- Assessment Modal -------- */

interface AssessmentModalProps {
  values: AssessmentFormValues;
  saving: boolean;
  onChange: <K extends keyof AssessmentFormValues>(
    field: K,
    value: AssessmentFormValues[K]
  ) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

function AssessmentModal({
  values,
  saving,
  onChange,
  onClose,
  onSubmit,
}: AssessmentModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Class Assessment
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Close
          </button>
        </div>

        <p className="mt-1 text-xs text-slate-500">
          Fill this quick assessment so parents can see the progress.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ScoreField
              label="Tajweed"
              value={values.tajweed_score}
              onChange={val => onChange('tajweed_score', val)}
            />
            <ScoreField
              label="Recitation"
              value={values.recitation_score}
              onChange={val => onChange('recitation_score', val)}
            />
            <ScoreField
              label="Hifz (memorisation)"
              value={values.hifz_score}
              onChange={val => onChange('hifz_score', val)}
            />
            <ScoreField
              label="Behaviour"
              value={values.behaviour_score}
              onChange={val => onChange('behaviour_score', val)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={values.homework_completed}
              onChange={e => onChange('homework_completed', e.target.checked)}
            />
            Homework completed
          </label>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Comments for parents
            </label>
            <textarea
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="e.g. Today he recited Surah Al-Fatiha with good fluency..."
              value={values.comments}
              onChange={e => onChange('comments', e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* -------- Tiny helper for 1–5 score fields -------- */

interface ScoreFieldProps {
  label: string;
  value: number | '';
  onChange: (value: number | '') => void;
}

function ScoreField({ label, value, onChange }: ScoreFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700">
        {label} (1–5)
      </label>
      <input
        type="number"
        min={1}
        max={5}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        value={value}
        onChange={e => {
          const val = e.target.value;
          if (val === '') onChange('');
          else onChange(Number(val));
        }}
      />
    </div>
  );
}
