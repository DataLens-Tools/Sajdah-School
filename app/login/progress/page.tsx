'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabaseClient';

interface AssessmentRow {
  id: string;
  created_at: string;
  rating: number | null;
  notes: string | null;
  class_start: string;
  class_end: string;
  teacher_name: string | null;
}

export default function StudentProgressPage() {
  const supabase = createClient();
  const [assessments, setAssessments] = React.useState<AssessmentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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

        const { data, error: assessErr } = await supabase
          .from('assessments')
          .select(
            `
            id,
            rating,
            notes,
            created_at,
            class_session:class_session_id (
              start_utc,
              end_utc,
              teacher:teacher_id (
                full_name
              )
            )
          `,
          )
          .eq('student_id', uid)
          .order('created_at', { ascending: false });

        if (assessErr) throw assessErr;

        const mapped: AssessmentRow[] =
          (data ?? []).map((row: any) => ({
            id: row.id,
            rating: row.rating,
            notes: row.notes,
            created_at: row.created_at,
            class_start: row.class_session?.start_utc,
            class_end: row.class_session?.end_utc,
            teacher_name: row.class_session?.teacher?.full_name ?? null,
          })) ?? [];

        setAssessments(mapped);
        setLoading(false);
      } catch (e: any) {
        console.error('student progress error:', e);
        setError(e.message ?? 'Unknown error');
        setLoading(false);
      }
    })();
  }, [supabase]);

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">
        Quran Progress Report
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Each row is feedback from one class. Parents can log in with the
        student account to review progress.
      </p>

      {loading && (
        <p className="mt-4 text-sm text-slate-500">Loading assessments…</p>
      )}

      {error && !loading && (
        <p className="mt-4 text-sm text-rose-600">Error: {error}</p>
      )}

      {!loading && !error && assessments.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">
          No assessments have been recorded yet.
        </p>
      )}

      {!loading && !error && assessments.length > 0 && (
        <div className="mt-6 space-y-3">
          {assessments.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {a.teacher_name || 'Teacher'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {a.class_start
                      ? formatDateTime(a.class_start)
                      : formatDateTime(a.created_at)}
                  </p>
                </div>
                {a.rating != null && (
                  <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    Rating:
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                      {a.rating}
                    </span>
                    /5
                  </div>
                )}
              </div>

              {a.notes && (
                <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">
                  {a.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
