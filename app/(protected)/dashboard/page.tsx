import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/client-server'

export default async function Dashboard() {
  const supabase = supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user?.id)
    .single()

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-2">Dashboard</h1>
      <p className="mb-4">Hola {profile?.full_name ?? 'usuario'} · Rol: {profile?.role}</p>
      <ul className="list-disc ml-6">
        <li><Link href="/worker">Operario</Link></li>
        <li><Link href="/coordinator/team">Coordinador</Link></li>
        <li><Link href="/boss/approvals">Jefe</Link></li>
        <li><Link href="/hr/reports">Talento Humano</Link></li>
      </ul>
    </main>
  )
}
