'use client'
import { supabaseBrowser } from '@/lib/supabase/client-browser'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = supabaseBrowser()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      alert(error.message)
      return
    }
    router.push('/dashboard')
  }

  return (
    <main className="p-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold mb-4">Iniciar sesión</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="border p-2 rounded"/>
        <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} className="border p-2 rounded"/>
        <button disabled={loading} className="border p-2 rounded">{loading ? '...' : 'Entrar'}</button>
      </form>
    </main>
  )
}
