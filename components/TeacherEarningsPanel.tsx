"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient"; // same as your login page

const supabase = createClient();

type PayoutStatus = "unpaid" | "paid";

type Payout = {
  id: string;
  amount: number;
  currency: string | null;
  status: PayoutStatus;
  created_at: string;
  paid_at: string | null;
  class_session_id: string;
};

interface TeacherEarningsPanelProps {
  /** Current teacher's profile id (UUID from profiles.id) */
  teacherId: string;
}

function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0–11

  const monthStart = new Date(year, month, 1);
  const nextMonthStart = new Date(year, month + 1, 1);

  return {
    from: monthStart.toISOString(),
    to: nextMonthStart.toISOString(),
  };
}

export const TeacherEarningsPanel: React.FC<TeacherEarningsPanelProps> = ({
  teacherId,
}) => {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { from, to } = getCurrentMonthRange();

  useEffect(() => {
    if (!teacherId) return;

    const fetchPayouts = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("teacher_session_payouts")
        .select(
          "id, amount, currency, status, created_at, paid_at, class_session_id"
        )
        .eq("teacher_id", teacherId)
        .gte("created_at", from)
        .lt("created_at", to)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching payouts:", error);
        setError("Could not load earnings data.");
      } else {
        setPayouts((data || []) as Payout[]);
      }
      setLoading(false);
    };

    fetchPayouts();
  }, [teacherId, from, to]);

  const totalClasses = payouts.length;
  const totalAmount = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
  const unpaidAmount = payouts
    .filter((p) => p.status === "unpaid")
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const paidAmount = totalAmount - unpaidAmount;
  const currency = payouts[0]?.currency || "EUR";

  // Format month label like "November 2025"
  const monthLabel = new Date().toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="w-full rounded-3xl border border-emerald-100 bg-white/95 p-6 shadow-lg shadow-emerald-100/60">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            This Month&apos;s Earnings
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">
            {monthLabel}
          </h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
          Teacher Dashboard
        </span>
      </div>

      {/* Loading / Error states */}
      {loading && (
        <div className="mt-6 text-sm text-slate-500">
          Loading your earnings…
        </div>
      )}

      {error && !loading && (
        <div className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Summary stats */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
              <p className="text-xs font-medium text-emerald-800">
                Total earnings
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">
                {totalAmount.toFixed(2)}{" "}
                <span className="text-sm font-semibold text-emerald-700">
                  {currency}
                </span>
              </p>
              <p className="mt-1 text-xs text-emerald-900/80">
                Across {totalClasses} completed classes
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium text-slate-600">Unpaid</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {unpaidAmount.toFixed(2)}{" "}
                <span className="text-xs font-medium text-slate-500">
                  {currency}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Will be transferred by the admin
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-medium text-slate-600">Already paid</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {paidAmount.toFixed(2)}{" "}
                <span className="text-xs font-medium text-slate-500">
                  {currency}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Marked as paid by the admin
              </p>
            </div>
          </div>

          {/* Recent payouts list */}
          <div className="mt-8">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Recent classes & payouts
              </h3>
              <span className="text-xs text-slate-500">
                Showing latest {Math.min(6, payouts.length)} of{" "}
                {payouts.length}
              </span>
            </div>

            {payouts.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No completed classes recorded for this month yet.
              </p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/60">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Class ID
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white/60">
                    {payouts.slice(0, 6).map((payout) => {
                      const dateLabel = new Date(
                        payout.created_at
                      ).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      });

                      const statusBadge =
                        payout.status === "paid" ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Unpaid
                          </span>
                        );

                      return (
                        <tr key={payout.id}>
                          <td className="px-4 py-2 text-xs text-slate-700">
                            {dateLabel}
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-500">
                            #{payout.class_session_id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-2 text-right text-xs font-semibold text-slate-900">
                            {payout.amount.toFixed(2)}{" "}
                            <span className="text-[10px] font-medium text-slate-500">
                              {payout.currency || currency}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {statusBadge}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
