// app/student/dashboard/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

type TeacherMini = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type CourseMini = {
  id: string;
  title: string | null;
};

type SessionRow = {
  id: string;
  start_utc: string;
  end_utc: string;
  status: string | null;
  zoom_url: string | null;
  teacher_id: string;
  course_id: string | null;
};

type MessageRow = {
  id: string;
  teacher_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type AssessmentRow = {
  id: string;
  teacher_id: string;
  class_session_id: string | null;
  rating: number | null;
  notes: string | null;
  created_at: string;
};

function formatLocal(dtIso: string) {
  const d = new Date(dtIso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function minutesUntil(dtIso: string) {
  const ms = new Date(dtIso).getTime() - Date.now();
  return Math.round(ms / 60000);
}

function timeAgo(dtIso: string) {
  const diffMs = Date.now() - new Date(dtIso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export default async function StudentDashboardPage() {
  const supabase = createClient();

  // 1) auth user
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) redirect("/login");

  // 2) profile (for header)
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role")
    .eq("id", user.id)
    .maybeSingle();

  // Role guard (recommended)
  if (profile?.role && profile.role !== "student") {
    redirect("/dashboard");
  }

  const nowIso = new Date().toISOString();

  // 3) sessions (upcoming)
  const { data: upcomingRaw, error: sessErr } = await supabase
    .from("class_sessions")
    .select("id, start_utc, end_utc, status, zoom_url, teacher_id, course_id")
    .eq("student_id", user.id)
    .gte("end_utc", nowIso) // includes "currently live" sessions too
    .order("start_utc", { ascending: true })
    .limit(5);

  const upcoming = (upcomingRaw ?? []) as SessionRow[];
  const nextSession = upcoming[0] ?? null;

  // 4) latest message preview
  const { data: lastMsgRaw, error: msgErr } = await supabase
    .from("messages")
    .select("id, teacher_id, sender_id, body, created_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastMsg = (lastMsgRaw ?? null) as MessageRow | null;

  // 5) recent assessments preview (last 3)
  const { data: recentAssessmentsRaw, error: asmtErr } = await supabase
    .from("assessments")
    .select("id, teacher_id, class_session_id, rating, notes, created_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);

  const recentAssessments = (recentAssessmentsRaw ?? []) as AssessmentRow[];

  // 6) fetch teacher + course mini records for display
  const teacherIds = Array.from(
    new Set([
      ...upcoming.map((s) => s.teacher_id),
      ...(lastMsg?.teacher_id ? [lastMsg.teacher_id] : []),
      ...recentAssessments.map((a) => a.teacher_id),
    ])
  ).filter(Boolean);

  const courseIds = Array.from(new Set(upcoming.map((s) => s.course_id)))
    .filter(Boolean) as string[];

  const [{ data: teachers }, { data: courses }] = await Promise.all([
    teacherIds.length
      ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", teacherIds)
      : Promise.resolve({ data: [] as TeacherMini[] }),
    courseIds.length
      ? supabase.from("courses").select("id, title").in("id", courseIds)
      : Promise.resolve({ data: [] as CourseMini[] }),
  ]);

  const teacherMap = new Map((teachers ?? []).map((t: TeacherMini) => [t.id, t]));
  const courseMap = new Map((courses ?? []).map((c: CourseMini) => [c.id, c]));

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Student Dashboard</h1>
          <p className="text-sm text-gray-600">
            Assalamu alaikum{profile?.full_name ? `, ${profile.full_name}` : ""} 👋
          </p>
          {profileErr ? (
            <p className="mt-1 text-xs text-red-600">Profile error: {profileErr.message}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-200">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-gray-700">
                {(profile?.full_name?.[0] ?? "S").toUpperCase()}
              </div>
            )}
          </div>

          <Link href="/logout" className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
            Logout
          </Link>
        </div>
      </div>

      {/* Error state */}
      {sessErr ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load sessions: {sessErr.message}
        </div>
      ) : null}

      {/* Main cards */}
      <div className="mt-6 grid grid-cols-1 gap-4">
        {/* Next Class Card */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Next class</p>

              {nextSession ? (
                <>
                  <h2 className="mt-2 text-lg font-semibold">
                    {courseMap.get(nextSession.course_id ?? "")?.title ?? "Lesson"}
                  </h2>

                  <p className="mt-1 text-sm text-gray-700">
                    {formatLocal(nextSession.start_utc)} – {formatLocal(nextSession.end_utc)}
                  </p>

                  <p className="mt-2 text-sm text-gray-600">
                    Teacher:{" "}
                    <span className="font-medium text-gray-800">
                      {teacherMap.get(nextSession.teacher_id)?.full_name ?? "Teacher"}
                    </span>
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                      {nextSession.status ?? "Scheduled"}
                    </span>

                    {minutesUntil(nextSession.start_utc) > 0 ? (
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                        Starts in ~{minutesUntil(nextSession.start_utc)} min
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs text-green-700">
                        In progress / Starting now
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-600">
                  No upcoming classes yet. Your schedule will appear here when sessions are booked.
                </p>
              )}
            </div>

            <div className="shrink-0">
              {nextSession?.zoom_url ? (
                <a
                  href={nextSession.zoom_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Join
                </a>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-600"
                >
                  Join
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Upcoming classes list */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Upcoming classes</p>
            <Link href="/student/classes" className="text-sm text-blue-700 hover:underline">
              View all
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">No upcoming classes scheduled.</p>
          ) : (
            <div className="mt-3 divide-y">
              {upcoming.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">
                      {courseMap.get(s.course_id ?? "")?.title ?? "Lesson"}
                    </p>
                    <p className="text-xs text-gray-600">
                      {formatLocal(s.start_utc)} •{" "}
                      {teacherMap.get(s.teacher_id)?.full_name ?? "Teacher"}
                    </p>
                  </div>
                  {s.zoom_url ? (
                    <a
                      href={s.zoom_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-50"
                    >
                      Join
                    </a>
                  ) : (
                    <span className="text-xs text-gray-500">No link</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages card */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Messages</p>
            <Link href="/student/messages" className="text-sm text-blue-700 hover:underline">
              Open
            </Link>
          </div>

          {msgErr ? (
            <p className="mt-3 text-sm text-red-600">Failed to load messages: {msgErr.message}</p>
          ) : !lastMsg ? (
            <p className="mt-3 text-sm text-gray-600">
              No messages yet. You can message your teacher anytime.
            </p>
          ) : (
            <div className="mt-3 rounded-lg bg-gray-50 p-4">
              <p className="text-xs text-gray-500">
                {teacherMap.get(lastMsg.teacher_id)?.full_name ?? "Teacher"} • {timeAgo(lastMsg.created_at)}
              </p>
              <p className="mt-2 text-sm text-gray-800 line-clamp-2">{lastMsg.body}</p>
            </div>
          )}
        </div>

        {/* Assessments card */}
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Assessments</p>
            <Link href="/student/assessments" className="text-sm text-blue-700 hover:underline">
              View
            </Link>
          </div>

          {asmtErr ? (
            <p className="mt-3 text-sm text-red-600">Failed to load assessments: {asmtErr.message}</p>
          ) : recentAssessments.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">
              No assessments yet. Feedback will appear here after your classes.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {recentAssessments.map((a) => (
                <div key={a.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">
                      {teacherMap.get(a.teacher_id)?.full_name ?? "Teacher"} •{" "}
                      {new Date(a.created_at).toLocaleDateString()}
                    </p>

                    {typeof a.rating === "number" && a.rating !== null ? (
                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs text-green-700">
                        Rating: {a.rating}/5
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                        Feedback
                      </span>
                    )}
                  </div>

                  {a.notes ? (
                    <p className="mt-2 text-sm text-gray-800 line-clamp-2">{a.notes}</p>
                  ) : (
                    <p className="mt-2 text-sm text-gray-600">No notes added.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
