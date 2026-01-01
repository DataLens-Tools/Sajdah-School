'use client';

import * as React from 'react';
import { createClient } from '@/lib/supabaseClient';

export default function AdminLiveClassesPage() {
  const supabase = createClient();
  const [rows, setRows] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: sess, error: sessErr } = await supabase
          .from('class_sessions')
          .select(
            `
            id,
            start_utc,
            end_utc,
            zoom_url,
            status,
            teacher:teacher_id (
              full_name
            ),
            student:student_id (
              full_name
            )
          `,
          )
          .eq('status', 'live')
          .order('start_utc', { ascending: true });

        if (sessErr) throw sessErr;
        setRows(sess ?? []);
        setLoading(false);
      } catch (e: any) {
        console.error('admin live classes error:', e);
        setError(e.message ?? 'Unknown error');
        setLoading(false);
      }
    })();
  }, [supabase]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Live Classes</h1>

      {loading && (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      )}

      {error && !loading && (
        <p className="mt-4 text-sm text-rose-600">Error: {error}</p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">
          No teachers are currently live.
        </p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="mt-6 space-y-3">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-col justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {r.teacher?.full_name || 'Teacher'} →{' '}
                  {r.student?.full_name || 'Student'}
                </p>
                <p className="text-xs text-slate-500">
                  {r.start_utc} – {r.end_utc}
                </p>
              </div>
              {r.zoom_url && (
                <a
                  href={r.zoom_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Join Zoom
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
