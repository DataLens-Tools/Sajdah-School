import { createServer } from '@/lib/supabaseServer'

export default async function StudentDashboard() {
  const supabase = createServer()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: sessions } = await supabase
    .from('class_sessions')
    .select('id,start_utc,end_utc')
    .eq('student_id', user?.id)

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold">Student Dashboard</h1>
      <pre className="mt-6 bg-slate-100 p-4 rounded text-sm">{JSON.stringify(sessions, null, 2)}</pre>
    </main>
  )
}
