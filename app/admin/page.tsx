import { createServer } from '@/lib/supabaseServer'

export default async function AdminDashboard() {
  const supabase = createServer()
  const { data: users } = await supabase.from('profiles').select('id, full_name, role').limit(20)

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold">Admin</h1>
      <pre className="mt-6 bg-slate-100 p-4 rounded text-sm">{JSON.stringify(users, null, 2)}</pre>
    </main>
  )
}
