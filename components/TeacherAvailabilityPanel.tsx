'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

type DaySlot = {
  weekday: number;        // 0 = Monday ... 6 = Sunday
  start_time: string;     // "14:00"
  end_time: string;       // "16:00"
  is_active: boolean;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface TeacherAvailabilityPanelProps {
  teacherId: string;
}

const defaultWeek: DaySlot[] = Array.from({ length: 7 }).map((_, i) => ({
  weekday: i,
  start_time: '16:00',
  end_time: '18:00',
  is_active: false,
}));

const TeacherAvailabilityPanel: React.FC<TeacherAvailabilityPanelProps> = ({
  teacherId,
}) => {
  const supabase = createClient();

  const [slots, setSlots] = useState<DaySlot[]>(defaultWeek);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!teacherId) return;

    const fetchAvailability = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('teacher_availability')
        .select('weekday, start_time, end_time, is_active')
        .eq('teacher_id', teacherId)
        .order('weekday', { ascending: true });

      if (error) {
        console.error('fetch availability error:', error);
        setError('Could not load your availability.');
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setSlots(defaultWeek);
      } else {
        const merged = defaultWeek.map((d) => {
          const found = data.find((row) => row.weekday === d.weekday);
          if (!found) return d;

          return {
            weekday: found.weekday,
            start_time: (found.start_time as string).slice(0, 5),
            end_time: (found.end_time as string).slice(0, 5),
            is_active: found.is_active ?? true,
          };
        });
        setSlots(merged);
      }

      setLoading(false);
    };

    fetchAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  const updateSlot = (
    weekday: number,
    field: keyof DaySlot,
    value: string | boolean,
  ) => {
    setSlots((prev) =>
      prev.map((slot) =>
        slot.weekday === weekday
          ? { ...slot, [field]: value }
          : slot,
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = slots.map((s) => ({
        teacher_id: teacherId,
        weekday: s.weekday,
        start_time: s.start_time,
        end_time: s.end_time,
        is_active: s.is_active,
      }));

      const { error } = await supabase
        .from('teacher_availability')
        .upsert(payload, { onConflict: 'teacher_id,weekday' });

      if (error) throw error;

      setSuccess('Availability saved successfully.');
    } catch (e: any) {
      console.error('save availability error:', e);
      setError(e.message ?? 'Failed to save availability.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8 rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-lg shadow-emerald-100/60">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Weekly availability
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">
            When can students book you?
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Set your usual times for each day. Admin can use this for scheduling.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading availability…</p>
      ) : (
        <>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/60">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Day
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Start
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    End
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Active
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white/60">
                {slots.map((slot) => (
                  <tr key={slot.weekday}>
                    <td className="px-4 py-2 text-xs font-medium text-slate-800">
                      {WEEKDAYS[slot.weekday]}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-700">
                      <input
                        type="time"
                        value={slot.start_time}
                        onChange={(e) =>
                          updateSlot(slot.weekday, 'start_time', e.target.value)
                        }
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-700">
                      <input
                        type="time"
                        value={slot.end_time}
                        onChange={(e) =>
                          updateSlot(slot.weekday, 'end_time', e.target.value)
                        }
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-slate-700">
                      <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={slot.is_active}
                          onChange={(e) =>
                            updateSlot(
                              slot.weekday,
                              'is_active',
                              e.target.checked,
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Available</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <p className="mt-3 text-xs text-rose-600">
              {error}
            </p>
          )}
          {success && (
            <p className="mt-3 text-xs text-emerald-700">
              {success}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save availability'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherAvailabilityPanel;
