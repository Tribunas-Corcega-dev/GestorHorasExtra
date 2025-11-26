"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageOvertime } from "@/lib/permissions"
import { formatDateForDisplay } from "@/lib/utils"
import { useRouter, useParams } from "next/navigation"
import { formatMinutesToHHMM } from "@/hooks/useOvertimeCalculator"

export default function HistorialHorasExtraPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <HistorialContent />
            </Layout>
        </ProtectedRoute>
    )
}

const LABELS = {
    extra_diurna: "Extra Diurna",
    extra_nocturna: "Extra Nocturna",
    extra_diurna_festivo: "Extra Diurna Festivo",
    extra_nocturna_festivo: "Extra Nocturna Festivo",
    recargo_nocturno: "Recargo Nocturno",
    dominical_festivo: "Dominical/Festivo",
    recargo_nocturno_festivo: "Recargo Nocturno Festivo"
}

// Helper to format minutes to float hours (e.g. 90 -> 1.5h)
function formatMinutesToFloat(minutes) {
    if (!minutes) return "0h"
    const hours = minutes / 60
    // Remove trailing zeros after decimal if integer, otherwise max 2 decimals
    return `${parseFloat(hours.toFixed(2))}h`
}

function HistorialContent() {
    const params = useParams()
    const { user } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [empleado, setEmpleado] = useState(null)
    const [jornadas, setJornadas] = useState([])
    const [summary, setSummary] = useState({
        totalOvertimeHours: "00:00",
        totalOvertimeMinutes: 0,
        breakdown: {}
    })

    useEffect(() => {
        if (user && !canManageOvertime(user.rol)) {
            router.push("/dashboard")
        }
        if (params?.id) {
            fetchData()
        }
    }, [user, router, params?.id])

    async function fetchData() {
        try {
            // Fetch employee data
            const empRes = await fetch(`/api/empleados/${params.id}`)
            if (empRes.ok) {
                const empData = await empRes.json()
                setEmpleado(empData)
            }

            // Fetch history
            const histRes = await fetch(`/api/jornadas?empleado_id=${params.id}`)
            if (histRes.ok) {
                const histData = await histRes.json()
                setJornadas(histData)

                // Calculate summary from stored values
                let totalMinutes = 0
                const breakdownTotals = {
                    extra_diurna: 0,
                    extra_nocturna: 0,
                    extra_diurna_festivo: 0,
                    extra_nocturna_festivo: 0,
                    recargo_nocturno: 0,
                    dominical_festivo: 0,
                    recargo_nocturno_festivo: 0
                }

                histData.forEach(jornada => {
                    if (jornada.horas_extra_hhmm) {
                        totalMinutes += jornada.horas_extra_hhmm.minutes || 0

                        if (jornada.horas_extra_hhmm.breakdown) {
                            Object.entries(jornada.horas_extra_hhmm.breakdown).forEach(([key, val]) => {
                                if (breakdownTotals[key] !== undefined) {
                                    breakdownTotals[key] += val
                                }
                            })
                        }
                    }
                })

                setSummary({
                    totalOvertimeHours: formatMinutesToHHMM(totalMinutes),
                    totalOvertimeMinutes: totalMinutes,
                    breakdown: breakdownTotals
                })
            }
        } catch (error) {
            console.error("Error fetching data:", error)
        } finally {
            setLoading(false)
        }
    }

    if (!canManageOvertime(user?.rol)) {
        return null
    }

    if (loading) {
        return <div className="text-center py-8">Cargando...</div>
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Historial de Horas Extra</h1>
                    {empleado && (
                        <p className="text-muted-foreground mt-1">
                            {empleado.nombre || empleado.username} • {empleado.cargo}
                        </p>
                    )}
                </div>
                <button
                    onClick={() => router.push("/horas-extra")}
                    className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors text-foreground text-sm font-medium"
                >
                    Volver
                </button>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 shadow-sm col-span-2 md:col-span-4 lg:col-span-1 flex flex-col justify-center">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Total General</h3>
                    <div className="text-2xl font-bold text-primary">
                        {formatMinutesToFloat(summary.totalOvertimeMinutes)}
                    </div>
                    <div className="text-xs text-primary/70 font-medium">
                        {summary.totalOvertimeHours}
                    </div>
                </div>

                {Object.entries(summary.breakdown).map(([key, minutes]) => {
                    if (minutes === 0) return null
                    return (
                        <div key={key} className="bg-card border border-border rounded-lg p-4 shadow-sm">
                            <h3 className="text-xs font-medium text-muted-foreground mb-1 truncate" title={LABELS[key]}>
                                {LABELS[key]}
                            </h3>
                            <div className="text-xl font-semibold text-foreground">
                                {formatMinutesToFloat(minutes)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {formatMinutesToHHMM(minutes)}
                            </div>
                        </div>
                    )
                })}
            </div>

            {jornadas.length === 0 ? (
                <div className="text-center py-12 bg-card border border-border rounded-lg">
                    <p className="text-muted-foreground">No hay registros de horas extra para este empleado.</p>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Fecha</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Día</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Tipo</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Horario</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Detalle Horas Extra</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-foreground">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {jornadas.map((jornada) => {
                                    const schedule = jornada.jornada_base_calcular
                                    const dayName = new Date(jornada.fecha).toLocaleDateString('es-ES', { weekday: 'long' })
                                    const overtimeFormatted = jornada.horas_extra_hhmm?.formatted || "-"
                                    const overtimeMinutes = jornada.horas_extra_hhmm?.minutes || 0
                                    const breakdown = jornada.horas_extra_hhmm?.breakdown || {}
                                    const hasBreakdown = Object.values(breakdown).some(v => v > 0)

                                    return (
                                        <tr key={jornada.id} className="hover:bg-accent/50 transition-colors">
                                            <td className="px-4 py-3 text-sm text-foreground font-medium whitespace-nowrap">
                                                {formatDateForDisplay(jornada.fecha)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-foreground capitalize">
                                                {dayName}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {jornada.es_festivo ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                                        Festivo
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">Ordinario</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-foreground">
                                                <div className="flex flex-col gap-1">
                                                    {schedule.morning.enabled && (
                                                        <span className="text-xs">M: {schedule.morning.start}-{schedule.morning.end}</span>
                                                    )}
                                                    {schedule.afternoon.enabled && (
                                                        <span className="text-xs">T: {schedule.afternoon.start}-{schedule.afternoon.end}</span>
                                                    )}
                                                    {!schedule.morning.enabled && !schedule.afternoon.enabled && (
                                                        <span className="text-xs italic text-muted-foreground">Sin turno</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {hasBreakdown ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {Object.entries(breakdown).map(([key, minutes]) => {
                                                            if (minutes <= 0) return null
                                                            return (
                                                                <span key={key} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-secondary text-secondary-foreground border border-border" title={LABELS[key]}>
                                                                    {LABELS[key]}: {formatMinutesToFloat(minutes)}
                                                                </span>
                                                            )
                                                        })}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-bold text-primary text-right">
                                                {overtimeMinutes > 0 ? (
                                                    <div className="flex flex-col items-end">
                                                        <span>{formatMinutesToFloat(overtimeMinutes)}</span>
                                                        <span className="text-xs text-muted-foreground font-normal">{overtimeFormatted}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground font-normal">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
