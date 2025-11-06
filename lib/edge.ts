import { supabaseBrowser } from '@/lib/supabase/client-browser'

export async function callEdge<T = unknown>(fn: string, body?: unknown): Promise<T> {
  const supabase = supabaseBrowser()
  const { data: { session } } = await supabase.auth.getSession()

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<T>
}
