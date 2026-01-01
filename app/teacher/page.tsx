import { createServer } from '@/lib/supabaseServer'

export default async function TeacherDashboard() {
  const supabase = createServer()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: slots } = await supabase
    .from('teacher_availability')
    .select('*').eq('teacher_id', user?.id)

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
      <pre className="mt-6 bg-slate-100 p-4 rounded text-sm">{JSON.stringify(slots, null, 2)}</pre>
    </main>
  )
}
