"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { canManageOvertime } from "@/lib/permissions"
import { formatDateForDisplay } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { formatMinutesToHHMM } from "@/hooks/useOvertimeCalculator"
import { calculateTotalOvertimeValue } from "@/lib/calculations"

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

function formatCurrency(value) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value)
}

export function OvertimeHistoryView({ employeeId, showBackButton = true }) {
    const { user } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [empleado, setEmpleado] = useState(null)
    const [jornadas, setJornadas] = useState([])
    const [recargos, setRecargos] = useState([])
    const [summary, setSummary] = useState({
        totalOvertimeHours: "00:00",
        totalOvertimeMinutes: 0,
        totalValue: 0,
        breakdown: {}
    })

    const [selectedJornada, setSelectedJornada] = useState(null)

    useEffect(() => {
        // Redirect if user is not authorized to view THIS employee's history
        // Allow if:
        // 1. User is a manager (canManageOvertime)
        // 2. User is viewing their own history (user.id === employeeId)
        if (user) {
            const isManager = canManageOvertime(user.rol)
            const isOwnHistory = user.id === employeeId

            if (!isManager && !isOwnHistory) {
                router.push("/dashboard")
                return
            }
        }

        if (employeeId) {
            fetchData()
        }
    }, [user, router, employeeId])

    async function fetchData() {
        try {
            // Fetch employee data
            const empRes = await fetch(`/api/empleados/${employeeId}`)
            let empData = null
            if (empRes.ok) {
                empData = await empRes.json()
                setEmpleado(empData)
            }

            // Fetch surcharges
            const recargosRes = await fetch("/api/recargos")
            let recargosData = []
            if (recargosRes.ok) {
                recargosData = await recargosRes.json()
                setRecargos(recargosData)
            }

            // Fetch history
            const histRes = await fetch(`/api/jornadas?empleado_id=${employeeId}`)
            if (histRes.ok) {
                const histData = await histRes.json()
                setJornadas(histData)

                // Calculate summary from stored values
                let totalMinutes = 0
                let totalValue = 0
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
                            // Accumulate minutes
                            Object.entries(jornada.horas_extra_hhmm.breakdown).forEach(([key, val]) => {
                                if (breakdownTotals[key] !== undefined) {
                                    breakdownTotals[key] += val
                                }
                            })

                            // Calculate value for this day
                            if (empData && empData.valor_hora) {
                                totalValue += calculateTotalOvertimeValue(
                                    jornada.horas_extra_hhmm.breakdown,
                                    empData.valor_hora,
                                    recargosData
                                )
                            }
                        }
                    }
                })

                setSummary({
                    totalOvertimeHours: formatMinutesToHHMM(totalMinutes),
                    totalOvertimeMinutes: totalMinutes,
                    totalValue: totalValue,
                    breakdown: breakdownTotals
                })
            }
        } catch (error) {
            console.error("Error fetching data:", error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <div className="text-center py-8">Cargando...</div>
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Historial de Horas Extra</h1>
                    {empleado && (
                        <div className="mt-4 flex items-center gap-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden relative flex-shrink-0">
                                {empleado.foto_url ? (
                                    <img
                                        src={empleado.foto_url}
                                        alt={`Foto de ${empleado.nombre || empleado.username}`}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <span className="text-xl font-bold text-primary">
                                        {(empleado.nombre || empleado.username || "?").charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div>
                                <h2 className="font-semibold text-lg text-foreground">{empleado.nombre || empleado.username}</h2>
                                <div className="text-sm text-muted-foreground">
                                    <p>CC: {empleado.cc || "No registrada"}</p>
                                    {empleado.valor_hora && (
                                        <p>Valor Hora: <span className="font-semibold text-foreground">{formatCurrency(empleado.valor_hora)}</span></p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {showBackButton && (
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors text-foreground text-sm font-medium"
                    >
                        Volver
                    </button>
                )}
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 shadow-sm col-span-2 md:col-span-4 lg:col-span-1 flex flex-col justify-center">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Total General</h3>
                    <div className="text-2xl font-bold text-primary">
                        {formatMinutesToFloat(summary.totalOvertimeMinutes)}
                    </div>
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400 mt-1">
                        {formatCurrency(summary.totalValue)}
                    </div>
                </div>

                {Object.entries(summary.breakdown).map(([key, minutes]) => {
                    if (minutes === 0) return null

                    let value = 0
                    if (empleado && empleado.valor_hora && recargos.length > 0) {
                        const breakdownObj = { [key]: minutes }
                        value = calculateTotalOvertimeValue(breakdownObj, empleado.valor_hora, recargos)
                    }

                    return (
                        <div key={key} className="bg-card border border-border rounded-lg p-4 shadow-sm">
                            <h3 className="text-xs font-medium text-muted-foreground mb-1 truncate" title={LABELS[key]}>
                                {LABELS[key]}
                            </h3>
                            <div className="text-xl font-semibold text-foreground">
                                {formatMinutesToFloat(minutes)}
                            </div>
                            <div className="text-sm font-medium text-green-600 dark:text-green-400">
                                {formatCurrency(value)}
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
                                    <th className="px-4 py-3 text-right text-sm font-medium text-foreground">Valor</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-foreground">Total</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-foreground">Acciones</th>
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

                                    let dayValue = 0
                                    if (empleado && empleado.valor_hora && recargos.length > 0) {
                                        dayValue = calculateTotalOvertimeValue(breakdown, empleado.valor_hora, recargos)
                                    }

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
                                                            // Calculate individual value
                                                            let itemValue = 0
                                                            if (empleado && empleado.valor_hora && recargos.length > 0) {
                                                                const breakdownObj = { [key]: minutes }
                                                                itemValue = calculateTotalOvertimeValue(breakdownObj, empleado.valor_hora, recargos)
                                                            }

                                                            return (
                                                                <span key={key} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-secondary text-secondary-foreground border border-border mr-1 mb-1" title={`${LABELS[key]}: ${formatCurrency(itemValue)}`}>
                                                                    {LABELS[key]}: {formatMinutesToFloat(minutes)}
                                                                </span>
                                                            )
                                                        })}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-bold text-green-600 dark:text-green-400 text-right whitespace-nowrap">
                                                {dayValue > 0 ? formatCurrency(dayValue) : "-"}
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
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={() => setSelectedJornada(jornada)}
                                                    className="text-primary hover:text-primary/80 text-sm font-medium underline"
                                                >
                                                    Ver Detalles
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {selectedJornada && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <h3 className="text-xl font-bold text-foreground">Detalles de la Jornada</h3>
                            <button
                                onClick={() => setSelectedJornada(null)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 18 18" /></svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Fecha</p>
                                    <p className="font-medium text-foreground">{formatDateForDisplay(selectedJornada.fecha)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tipo de Día</p>
                                    <p className="font-medium text-foreground">
                                        {selectedJornada.es_festivo ? "Festivo" : "Ordinario"}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Horario Base</p>
                                <div className="bg-muted/50 p-3 rounded-md text-sm space-y-1">
                                    <div className="flex justify-between">
                                        <span>Mañana:</span>
                                        <span className="font-medium">
                                            {selectedJornada.jornada_base_calcular.morning.enabled
                                                ? `${selectedJornada.jornada_base_calcular.morning.start} - ${selectedJornada.jornada_base_calcular.morning.end}`
                                                : "No labora"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Tarde:</span>
                                        <span className="font-medium">
                                            {selectedJornada.jornada_base_calcular.afternoon.enabled
                                                ? `${selectedJornada.jornada_base_calcular.afternoon.start} - ${selectedJornada.jornada_base_calcular.afternoon.end}`
                                                : "No labora"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Desglose de Horas Extra</p>
                                {selectedJornada.horas_extra_hhmm?.breakdown && Object.keys(selectedJornada.horas_extra_hhmm.breakdown).length > 0 ? (
                                    <div className="space-y-2">
                                        {Object.entries(selectedJornada.horas_extra_hhmm.breakdown).map(([key, val]) => {
                                            if (val <= 0) return null
                                            return (
                                                <div key={key} className="flex justify-between text-sm border-b border-border/50 pb-1 last:border-0">
                                                    <span className="text-muted-foreground">{LABELS[key]}</span>
                                                    <span className="font-medium text-foreground">{formatMinutesToFloat(val)}</span>
                                                </div>
                                            )
                                        })}
                                        <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                                            <span>Total</span>
                                            <span className="text-primary">{selectedJornada.horas_extra_hhmm.formatted}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">No hay horas extra registradas</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Registrado Por</p>
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                                            {(selectedJornada.registrador?.nombre || selectedJornada.registrador?.username || "?").charAt(0).toUpperCase()}
                                        </div>
                                        <p className="text-sm font-medium text-foreground truncate">
                                            {selectedJornada.registrador?.nombre || selectedJornada.registrador?.username || "Desconocido"}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Aprobado Por</p>
                                    {selectedJornada.aprobador ? (
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                                                {(selectedJornada.aprobador.nombre || selectedJornada.aprobador.username || "?").charAt(0).toUpperCase()}
                                            </div>
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {selectedJornada.aprobador.nombre || selectedJornada.aprobador.username}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">Pendiente / No aplica</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
                            <button
                                onClick={() => setSelectedJornada(null)}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
