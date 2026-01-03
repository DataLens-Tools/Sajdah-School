// app/student/classes/page.tsx
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

export default async function StudentClassesPage() {
  const supabase = createClient();

  // auth
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) redirect("/login");

  // role guard
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role && profile.role !== "student") redirect("/dashboard");

  const nowIso = new Date().toISOString();

  // upcoming
  const { data: upcomingRaw, error: upErr } = await supabase
    .from("class_sessions")
    .select("id, start_utc, end_utc, status, zoom_url, teacher_id, course_id")
    .eq("student_id", user.id)
    .gt("start_utc", nowIso)
    .order("start_utc", { ascending: true })
    .limit(50);

  // history
  const { data: historyRaw, error: histErr } = await supabase
    .from("class_sessions")
    .select("id, start_utc, end_utc, status, zoom_url, teacher_id, course_id")
    .eq("student_id", user.id)
    .lt("end_utc", nowIso)
    .order("start_utc", { ascending: false })
    .limit(50);

  const upcoming = (upcomingRaw ?? []) as SessionRow[];
  const history = (historyRaw ?? []) as SessionRow[];

  // fetch teachers + courses for both lists
  const teacherIds = Array.from(
    new Set([...upcoming, ...history].map((s) => s.teacher_id))
  ).filter(Boolean);

  const courseIds = Array.from(
    new Set([...upcoming, ...history].map((s) => s.course_id).filter(Boolean))
  ) as string[];

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Classes</h1>
          <p className="text-sm text-gray-600">Upcoming schedule and class history.</p>
        </div>
        <Link href="/student/dashboard" className="text-sm text-blue-700 hover:underline">
          Back to dashboard
        </Link>
      </div>

      {(upErr || histErr) && (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {upErr ? <div>Upcoming error: {upErr.message}</div> : null}
          {histErr ? <div>History error: {histErr.message}</div> : null}
        </div>
      )}

      {/* Upcoming */}
      <div className="mt-6 rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Upcoming</p>
          <span className="text-xs text-gray-500">{upcoming.length} scheduled</span>
        </div>

        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">No upcoming classes.</p>
        ) : (
          <div className="mt-3 divide-y">
            {upcoming.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">
                    {courseMap.get(s.course_id ?? "")?.title ?? "Lesson"}
                  </p>
                  <p className="text-xs text-gray-600">
                    {formatLocal(s.start_utc)} – {formatLocal(s.end_utc)} •{" "}
                    {teacherMap.get(s.teacher_id)?.full_name ?? "Teacher"}
                  </p>
                  <div className="mt-1">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                      {s.status ?? "Scheduled"}
                    </span>
                  </div>
                </div>

                {s.zoom_url ? (
                  <a
                    href={s.zoom_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-black px-4 py-2 text-xs font-medium text-white hover:opacity-90"
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

      {/* History */}
      <div className="mt-4 rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">History</p>
          <span className="text-xs text-gray-500">{history.length} completed</span>
        </div>

        {history.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">No past classes yet.</p>
        ) : (
          <div className="mt-3 divide-y">
            {history.map((s) => (
              <div key={s.id} className="py-3">
                <p className="text-sm font-medium">
                  {courseMap.get(s.course_id ?? "")?.title ?? "Lesson"}
                </p>
                <p className="text-xs text-gray-600">
                  {formatLocal(s.start_utc)} – {formatLocal(s.end_utc)} •{" "}
                  {teacherMap.get(s.teacher_id)?.full_name ?? "Teacher"}
                </p>
                <div className="mt-1">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                    {s.status ?? "Completed"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
