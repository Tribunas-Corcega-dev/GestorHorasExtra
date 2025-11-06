import { useState, useCallback } from 'react'
import { callEdge } from '../lib/edge'

type ApproveResponse = { ok: true }

export function useApproveOvertime() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const approve = useCallback(async (overtimeId: number) => {
    setLoading(true); setError(null)
    try {
      const res = await callEdge<ApproveResponse>('approve-overtime', { overtimeId })
      return res
    } catch (e: any) {
      setError(e.message || 'Error')
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return { approve, loading, error }
}
