'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabaseClient'

export default function SignupPage() {
  const supabase = createClient()
  const sp = useSearchParams()
  const router = useRouter()
  const [role] = useState(sp.get('role') ?? 'student')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function onSignup(e: React.FormEvent) {
    e.preventDefault()
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: name } }
    })
    if (error || !data.user) return alert(error?.message ?? 'Error')
    await supabase.from('profiles').upsert({ id: data.user.id, role, full_name: name })
    router.replace('/login?role=' + role)
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold">Create Account</h1>
      <p className="text-sm opacity-70">Signing up as <b>{role}</b></p>
      <form onSubmit={onSignup} className="grid gap-3 mt-4">
        <input className="border rounded p-2" placeholder="full name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="border rounded p-2" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded p-2" type="password" placeholder="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="rounded bg-green-600 text-white py-2">Sign up</button>
      </form>
    </main>
  )
}
