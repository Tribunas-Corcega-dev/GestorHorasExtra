import { useState, useCallback } from 'react'
import { callEdge } from '../lib/edge'

type ReportResponse = { ok: true, report: any }

type ReportParams = {
  startDate: string
  endDate: string
  userId?: string
  area?: string
}

export function useGenerateReport() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateReport = useCallback(async (params: ReportParams) => {
    setLoading(true); setError(null)
    try {
      const res = await callEdge<ReportResponse>('generate-report', params)
      return res
    } catch (e: any) {
      setError(e.message || 'Error')
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return { generateReport, loading, error }
}
