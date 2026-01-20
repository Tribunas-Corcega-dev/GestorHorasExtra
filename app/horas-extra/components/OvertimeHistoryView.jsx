"use client"

import Link from "next/link"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { canManageOvertime } from "@/lib/permissions"
import { formatDateForDisplay } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { formatMinutesToHHMM } from "@/hooks/useOvertimeCalculator"
import { calculateTotalOvertimeValue, formatToAmPm, getSalaryForDate } from "@/lib/calculations"
import { supabase } from "@/lib/supabaseClient"
import { CompensatoryRequestModal } from "./CompensatoryRequestModal"
import { BalanceManagementModal } from "./BalanceManagementModal"

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
    const [showAppealModal, setShowAppealModal] = useState(false)
    const [appealDescription, setAppealDescription] = useState("")
    const [appealFiles, setAppealFiles] = useState([])

    // --- Bi-weekly Period Mockup State ---
    const [selectedPeriod, setSelectedPeriod] = useState("all") // 'all' or '2025-12-1', '2025-12-2', etc.
    const [periods, setPeriods] = useState([])
    const [fixedSurchargesData, setFixedSurchargesData] = useState(null)
    const [loadingFixed, setLoadingFixed] = useState(false)
    const [isCoordinator, setIsCoordinator] = useState(false)
    const [balanceData, setBalanceData] = useState(null)
    const [showBankingModal, setShowBankingModal] = useState(false)
    const [showManageModal, setShowManageModal] = useState(false)

    useEffect(() => {
        // Generate mock periods for the last 3 months
        const mockPeriods = []
        const today = new Date()
        for (let i = 0; i < 3; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
            const year = date.getFullYear()
            const month = date.getMonth()
            const monthName = date.toLocaleString('es-CO', { month: 'long' })

            mockPeriods.push({ id: `${year}-${month}-0`, label: `Mes Completo ${monthName} ${year}` })
            mockPeriods.push({ id: `${year}-${month}-2`, label: `2ª Quincena ${monthName} ${year} (16-End)` })
            mockPeriods.push({ id: `${year}-${month}-1`, label: `1ª Quincena ${monthName} ${year} (01-15)` })
        }
        setPeriods(mockPeriods)
    }, [])

    // Fetch fixed surcharges when period changes
    useEffect(() => {
        if (selectedPeriod !== 'all' && employeeId) {
            fetchFixedSurcharges()
        } else {
            setFixedSurchargesData(null)
        }
    }, [selectedPeriod, employeeId])

    async function fetchFixedSurcharges() {
        setLoadingFixed(true)
        try {
            const res = await fetch(`/api/cierres/calcular?empleado_id=${employeeId}&periodo=${selectedPeriod}`)
            if (res.ok) {
                const data = await res.json()
                setFixedSurchargesData(data)
            }
        } catch (error) {
            console.error("Error fetching fixed surcharges:", error)
        } finally {
            setLoadingFixed(false)
        }
    }

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
            setIsCoordinator(isManager)
        }

        if (employeeId) {
            fetchData()
        }
    }, [user, router, employeeId])

    const [closingRecord, setClosingRecord] = useState(null)
    const [loadingClosing, setLoadingClosing] = useState(false)

    // Fetch fixed surcharges and closing record when period changes
    useEffect(() => {
        if (selectedPeriod !== 'all' && employeeId) {
            fetchFixedSurcharges()
            fetchClosingRecord()
        } else {
            setFixedSurchargesData(null)
            setClosingRecord(null)
        }
    }, [selectedPeriod, employeeId])

    async function fetchFixedSurcharges() {
        setLoadingFixed(true)
        try {
            const res = await fetch(`/api/cierres/calcular?empleado_id=${employeeId}&periodo=${selectedPeriod}`)
            if (res.ok) {
                const data = await res.json()
                setFixedSurchargesData(data)
            }
        } catch (error) {
            console.error("Error fetching fixed surcharges:", error)
        } finally {
            setLoadingFixed(false)
        }
    }

    async function fetchClosingRecord() {
        setLoadingClosing(true)
        try {
            const [year, month, quincena] = selectedPeriod.split('-')
            const { data, error } = await supabase
                .from("cierres_quincenales")
                .select("*")
                .eq("empleado_id", employeeId)
                .eq("periodo_anio", year)
                .eq("periodo_mes", month)
                .eq("periodo_quincena", quincena)
                .single()

            if (data) {
                setClosingRecord(data)
            } else {
                setClosingRecord(null)
            }
        } catch (error) {
            console.error("Error fetching closing record:", error)
            setClosingRecord(null)
        } finally {
            setLoadingClosing(false)
        }
    }

    async function handleClosePeriod() {
        if (!confirm("¿Estás seguro de cerrar esta quincena? Esto generará un registro oficial de nómina.")) return

        try {
            const res = await fetch("/api/cierres", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    empleado_id: employeeId,
                    periodo: selectedPeriod
                })
            })

            if (res.ok) {
                const data = await res.json()
                setClosingRecord(data)
                alert("Quincena cerrada exitosamente.")
            } else {
                const err = await res.json()
                alert("Error al cerrar quincena: " + err.message)
            }
        } catch (error) {
            console.error("Error closing period:", error)
            alert("Error al cerrar quincena")
        }
    }

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

            // Fetch balance (Bolsa de Horas)
            const balanceRes = await fetch(`/api/compensatorios/saldo?userId=${employeeId}`)
            if (balanceRes.ok) {
                const balanceData = await balanceRes.json()
                setBalanceData(balanceData)
            }

            // Fetch history
            const histRes = await fetch(`/api/jornadas?empleado_id=${employeeId}`)
            if (histRes.ok) {
                const histData = await histRes.json()
                setJornadas(histData)
                // Initial summary calculation is handled by filteredSummary derived state now
            }
        } catch (error) {
            console.error("Error fetching data:", error)
        } finally {
            setLoading(false)
        }
    }

    // Filter jornadas based on period
    const filteredJornadas = jornadas.filter(j => {
        if (selectedPeriod === "all") return true
        const jDate = new Date(j.fecha)
        const [year, month, quincena] = selectedPeriod.split('-').map(Number)

        if (jDate.getFullYear() !== year || jDate.getMonth() !== month) return false

        // Full Month (0) includes everything for that month
        if (quincena === 0) return true

        const day = jDate.getDate()
        if (quincena === 1) return day <= 15
        if (quincena === 2) return day > 15
        return true
    })

    // Recalculate summary for filtered jornadas
    const filteredSummary = (() => {
        let totalMinutes = 0
        let totalValue = 0
        const overtimeTotals = { extra_diurna: 0, extra_nocturna: 0, extra_diurna_festivo: 0, extra_nocturna_festivo: 0 }
        const surchargeTotals = { recargo_nocturno: 0, dominical_festivo: 0, recargo_nocturno_festivo: 0 }

        const overtimeValues = { extra_diurna: 0, extra_nocturna: 0, extra_diurna_festivo: 0, extra_nocturna_festivo: 0 }
        const surchargeValues = { recargo_nocturno: 0, dominical_festivo: 0, recargo_nocturno_festivo: 0 }

        filteredJornadas.forEach(jornada => {
            if (jornada.horas_extra_hhmm) {
                totalMinutes += jornada.horas_extra_hhmm.minutes || 0

                const breakdown = jornada.horas_extra_hhmm.breakdown || {}
                const flatBreakdown = jornada.horas_extra_hhmm.flatBreakdown || breakdown

                // Aggregate
                if (breakdown.overtime) {
                    Object.entries(breakdown.overtime).forEach(([k, v]) => overtimeTotals[k] = (overtimeTotals[k] || 0) + v)
                } else {
                    Object.entries(flatBreakdown).forEach(([k, v]) => {
                        if (overtimeTotals[k] !== undefined) overtimeTotals[k] += v
                    })
                }

                if (breakdown.surcharges) {
                    Object.entries(breakdown.surcharges).forEach(([k, v]) => surchargeTotals[k] = (surchargeTotals[k] || 0) + v)
                } else {
                    Object.entries(flatBreakdown).forEach(([k, v]) => {
                        if (surchargeTotals[k] !== undefined) surchargeTotals[k] += v
                    })
                }

                // Determine hourly rate based on history > snapshot > current
                let hourlyRate = 0
                const historySalary = empleado ? getSalaryForDate(empleado.hist_salarios, jornada.fecha) : null

                if (historySalary) {
                    hourlyRate = Number(historySalary.hourlyRate)
                } else if (jornada && jornada.valor_hora_snapshot) {
                    hourlyRate = Number(jornada.valor_hora_snapshot)
                } else if (empleado) {
                    hourlyRate = Number(empleado.valor_hora)
                }

                if (hourlyRate > 0) {
                    // Check if hours are banked
                    // OLD LOGIC: const isBanked = ['SOLICITADO', 'APROBADO'].includes(jornada.estado_compensacion)
                    // NEW LOGIC: Deduct banked minutes from payable minutes

                    const bankedDesglose = jornada.desglose_compensacion || {}

                    totalValue += calculateTotalOvertimeValue(flatBreakdown, hourlyRate, recargos, bankedDesglose) // Needs update in lib? Or manually handled here?
                    // calculateTotalOvertimeValue doesn't support deduction arg. Let's do it manually or assume we modify breakdown.

                    // Modify flatBreakdown for calculation purposes (Deduct banked)
                    const payableBreakdown = { ...flatBreakdown }
                    Object.entries(bankedDesglose).forEach(([k, v]) => {
                        if (payableBreakdown[k]) {
                            payableBreakdown[k] = Math.max(0, payableBreakdown[k] - v)
                        }
                    })

                    totalValue += calculateTotalOvertimeValue(payableBreakdown, hourlyRate, recargos)

                    // Calculate individual values
                    if (recargos.length > 0) {
                        Object.entries(payableBreakdown).forEach(([type, minutes]) => {
                            if (minutes > 0) {
                                const surcharge = recargos.find(r => {
                                    const dbType = (r.tipo_hora_extra || "").trim().toLowerCase()
                                    const map = {
                                        "extra diurno": "extra_diurna",
                                        "trabajo extra nocturno": "extra_nocturna",
                                        "extra nocturna": "extra_nocturna",
                                        "trabajo extra diurno dominical y festivo": "extra_diurna_festivo",
                                        "extra diurna festivo": "extra_diurna_festivo",
                                        "trabajo extra nocturno en domingos y festivos": "extra_nocturna_festivo",
                                        "extra nocturna festivo": "extra_nocturna_festivo",
                                        "recargo nocturno": "recargo_nocturno",
                                        "trabajo nocturno": "recargo_nocturno",
                                        "trabajo dominical y festivo": "dominical_festivo",
                                        "dominical/festivo": "dominical_festivo",
                                        "trabajo nocturno en dominical y festivo": "recargo_nocturno_festivo",
                                        "recargo nocturno festivo": "recargo_nocturno_festivo"
                                    }
                                    return (map[dbType] || r.tipo_hora_extra) === type
                                })


                                const percentage = surcharge ? surcharge.recargo : 0
                                const hours = minutes / 60
                                const p = percentage > 2 ? percentage / 100 : percentage
                                const factor = 1 + p
                                const value = hours * hourlyRate * factor

                                if (overtimeValues[type] !== undefined) {
                                    overtimeValues[type] += value
                                } else if (surchargeValues[type] !== undefined) {
                                    surchargeValues[type] += value
                                }
                            }
                        })
                    }
                }
            }
        })

        return { totalMinutes, totalValue, overtimeTotals, surchargeTotals, overtimeValues, surchargeValues }
    })()

    // Use fetched data instead of mock
    const mockFixedSurcharges = fixedSurchargesData ? {
        recargo_nocturno: fixedSurchargesData.fixedSurcharges.recargo_nocturno || 0,
        dominical_festivo: fixedSurchargesData.fixedSurcharges.dominical_festivo || 0,
        recargo_nocturno_festivo: fixedSurchargesData.fixedSurcharges.recargo_nocturno_festivo || 0,
        value: fixedSurchargesData.totalValue || 0
    } : null

    if (loading) {
        return <div className="text-center py-8">Cargando...</div>
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                <div className="w-full md:w-auto">
                    <h1 className="text-3xl font-bold text-foreground">Historial de Horas Extra</h1>
                    {empleado && (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                            <Link href={`/empleados/${empleado.id}/detalles`}>
                                <div className="mt-4 flex items-center gap-4 hover:bg-neutral-100 dark:hover:bg-neutral-800 p-2 -ml-2 rounded-lg transition-colors cursor-pointer group">
                                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden relative flex-shrink-0 border-2 border-transparent group-hover:border-primary transition-colors">
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
                                        <h2 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                                            {empleado.nombre || empleado.username}
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </h2>
                                        <div className="text-sm text-muted-foreground">
                                            <p>CC: {empleado.cc || "No registrada"}</p>
                                            {empleado.valor_hora && (
                                                <p>Valor Hora: <span className="font-semibold text-foreground">{formatCurrency(empleado.valor_hora)}</span></p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Link>

                            {balanceData && (
                                <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800 min-w-[200px]">
                                    <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider mb-1">
                                        Bolsa de Horas
                                    </p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                                            {formatMinutesToFloat(balanceData.saldo_disponible)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            Disponibles
                                        </span>
                                    </div>
                                    {balanceData.saldo_pendiente > 0 && (
                                        <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 font-medium">
                                            {formatMinutesToFloat(balanceData.saldo_pendiente)} pendientes
                                        </p>
                                    )}
                                    {isCoordinator && (
                                        <div className="mt-2 text-center">
                                            <button
                                                onClick={() => setShowManageModal(true)}
                                                className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center justify-center gap-1 w-full"
                                            >
                                                Gestionar Bolsa
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto mb-6">
                {/* Period Selector */}
                <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-auto"
                >
                    <option value="all">Ver Todo el Historial</option>
                    {periods.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                </select>

                {isCoordinator && (
                    <Link
                        href={`/horas-extra/${employeeId}/registrar`}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Registrar Hora Extra
                    </Link>
                )}

                {/* Banking Button (Visible to Employee and Coordinators) */}
                <button
                    onClick={() => setShowBankingModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20" /><path d="M7 12v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-5" /><path d="M12 12V7" /></svg>
                    Ahorrar en Bolsa
                </button>

                {/* Close Period Button */}
                {user?.rol === 'TALENTO_HUMANO' && selectedPeriod !== 'all' && !closingRecord && (
                    <button
                        onClick={handleClosePeriod}
                        disabled={loadingClosing}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 w-full sm:w-auto"
                    >
                        {loadingClosing ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        Cerrar Quincena
                    </button>
                )}

                {showBackButton && (
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors text-foreground text-sm font-medium w-full sm:w-auto text-center"
                    >
                        Volver
                    </button>
                )}
            </div>


            {/* Closing Record View (Read-Only) */}
            {
                closingRecord ? (
                    <div className="bg-card border border-border rounded-lg p-6 shadow-sm mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Nómina Cerrada - {periods.find(p => p.value === selectedPeriod)?.label}
                            </h2>
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold uppercase">
                                {closingRecord.estado}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Fixed Surcharges */}
                            <div className="space-y-2">
                                <h3 className="font-semibold text-muted-foreground text-sm uppercase">Nómina Fija</h3>
                                <div className="bg-muted/50 p-3 rounded-md space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Recargo Nocturno:</span>
                                        <span className="font-medium">{formatMinutesToFloat(closingRecord.recargos_fijos?.recargo_nocturno || 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Dominical/Festivo:</span>
                                        <span className="font-medium">{formatMinutesToFloat(closingRecord.recargos_fijos?.dominical_festivo || 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>Recargo Nocturno Festivo:</span>
                                        <span className="font-medium">{formatMinutesToFloat(closingRecord.recargos_fijos?.recargo_nocturno_festivo || 0)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Reported Overtime */}
                            <div className="space-y-2">
                                <h3 className="font-semibold text-muted-foreground text-sm uppercase">Nómina Variable</h3>
                                <div className="bg-muted/50 p-3 rounded-md space-y-2">
                                    {Object.entries(closingRecord.horas_extra_reportadas || {}).map(([key, minutes]) => {
                                        if (minutes === 0) return null
                                        return (
                                            <div key={key} className="flex justify-between text-sm">
                                                <span className="truncate pr-2" title={LABELS[key]}>{LABELS[key]}</span>
                                                <span className="font-medium">{formatMinutesToFloat(minutes)}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Total */}
                            <div className="flex flex-col justify-center items-center bg-primary/5 rounded-lg p-4 border border-primary/10">
                                <span className="text-sm text-muted-foreground mb-1">Total a Pagar</span>
                                <span className="text-3xl font-bold text-primary">{formatCurrency(closingRecord.valor_total)}</span>
                                <p className="text-xs text-muted-foreground mt-2 text-center">
                                    Cierre generado el {new Date(closingRecord.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Live Preview (Existing View) */
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            {/* Fixed Surcharges Section (From DB Table) */}
                            <div className={`space-y-4 ${selectedPeriod === 'all' ? 'opacity-50 grayscale' : ''}`}>
                                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2 flex items-center justify-between">
                                    <span>Nómina Fija</span>
                                    {selectedPeriod === 'all' && <span className="text-xs font-normal text-muted-foreground">(Selecciona periodo)</span>}
                                </h3>
                                <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900 rounded-lg p-4 shadow-sm">
                                    {selectedPeriod !== 'all' ? (
                                        loadingFixed ? (
                                            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
                                                <p className="text-xs text-muted-foreground">Calculando...</p>
                                            </div>
                                        ) : mockFixedSurcharges ? (
                                            <>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Automático</span>
                                                    <span className="text-xs text-muted-foreground">Calculado por turno fijo</span>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Recargo Nocturno:</span>
                                                        <span className="font-medium">{formatMinutesToFloat(mockFixedSurcharges.recargo_nocturno)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Dominical/Festivo:</span>
                                                        <span className="font-medium">{formatMinutesToFloat(mockFixedSurcharges.dominical_festivo)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Recargo Nocturno Festivo:</span>
                                                        <span className="font-medium">{formatMinutesToFloat(mockFixedSurcharges.recargo_nocturno_festivo)}</span>
                                                    </div>
                                                    <div className="pt-3 border-t border-blue-200 dark:border-blue-800 mt-2">
                                                        <div className="flex justify-between items-end">
                                                            <span className="text-sm font-medium text-foreground">Total Fijo:</span>
                                                            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                                {formatCurrency(mockFixedSurcharges.value)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-center p-2 text-muted-foreground text-sm">
                                                <p>No hay datos disponibles para este periodo.</p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-center p-2 text-muted-foreground text-sm">
                                            <p>Selecciona una quincena para ver los recargos fijos calculados.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Reported Overtime Section (Variable) */}
                            <div className="md:col-span-2 space-y-4">
                                <h3 className="text-lg font-semibold text-foreground border-b border-border pb-2 flex items-center justify-between">
                                    <span>Nómina Variable (Reportada)</span>
                                    <span className="text-xs font-normal text-muted-foreground">Basado en {filteredJornadas.length} registros</span>
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Overtime */}
                                    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Horas Extra</h4>
                                        <div className="space-y-2">
                                            {Object.entries(filteredSummary.overtimeTotals).map(([key, minutes]) => {
                                                if (minutes === 0) return null
                                                const value = filteredSummary.overtimeValues[key] || 0
                                                return (
                                                    <div key={key} className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground truncate pr-2" title={LABELS[key]}>{LABELS[key]}</span>
                                                        <div className="text-right">
                                                            <span className="font-medium block">{formatMinutesToFloat(minutes)}</span>
                                                            <span className="text-xs text-green-600 dark:text-green-400 font-semibold">{formatCurrency(value)}</span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            {Object.values(filteredSummary.overtimeTotals).every(v => v === 0) && (
                                                <p className="text-sm text-muted-foreground italic">- Sin registros -</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Surcharges */}
                                    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Recargos Variables</h4>
                                        <div className="space-y-2">
                                            {Object.entries(filteredSummary.surchargeTotals).map(([key, minutes]) => {
                                                if (minutes === 0) return null
                                                const value = filteredSummary.surchargeValues[key] || 0
                                                return (
                                                    <div key={key} className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground truncate pr-2" title={LABELS[key]}>{LABELS[key]}</span>
                                                        <div className="text-right">
                                                            <span className="font-medium block">{formatMinutesToFloat(minutes)}</span>
                                                            <span className="text-xs text-green-600 dark:text-green-400 font-semibold">{formatCurrency(value)}</span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            {Object.values(filteredSummary.surchargeTotals).every(v => v === 0) && (
                                                <p className="text-sm text-muted-foreground italic">- Sin registros -</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Total Summary */}
                        <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 shadow-sm mb-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold text-primary uppercase tracking-wider break-words">Total General a Pagar</h3>
                                <p className="text-sm text-muted-foreground break-words">
                                    {selectedPeriod !== 'all'
                                        ? "Suma de Nómina Fija + Nómina Variable (Reportada)"
                                        : "Suma de todas las horas extra reportadas (Selecciona periodo para ver total real)"}
                                </p>
                            </div>
                            <div className="text-center md:text-right w-full md:w-auto">
                                <div className="text-3xl font-bold text-primary break-all">
                                    {formatCurrency(filteredSummary.totalValue + (mockFixedSurcharges?.value || 0))}
                                </div>
                                {selectedPeriod !== 'all' && (
                                    <div className="text-xs text-muted-foreground mt-1 break-words">
                                        Variable: {formatCurrency(filteredSummary.totalValue)} + Fijo: {formatCurrency(mockFixedSurcharges?.value || 0)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )
            }

            {
                filteredJornadas.length === 0 ? (
                    <div className="text-center py-12 bg-card border border-border rounded-lg">
                        <p className="text-muted-foreground">No hay registros de horas extra para este periodo.</p>
                    </div>
                ) : (
                    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto w-full max-w-full">
                            <table className="w-full">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Fecha</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Día</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Tipo</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Horario</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Horas Extra</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Recargos</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-foreground">Valor</th>
                                        <th className="px-4 py-3 text-right text-sm font-medium text-foreground">Total</th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-foreground">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredJornadas.map((jornada) => {
                                        const schedule = jornada.jornada_base_calcular
                                        const dayName = jornada.jornada_base_calcular?.dayOfWeek || ""
                                        const overtimeFormatted = jornada.horas_extra_hhmm?.formatted || "-"
                                        const overtimeMinutes = jornada.horas_extra_hhmm?.minutes || 0

                                        // Determine structured breakdown
                                        const breakdown = jornada.horas_extra_hhmm?.breakdown || {}
                                        const flatBreakdown = jornada.horas_extra_hhmm?.flatBreakdown || breakdown

                                        let overtimeBreakdown = {}
                                        let surchargeBreakdown = {}

                                        if (breakdown.overtime || breakdown.surcharges) {
                                            overtimeBreakdown = breakdown.overtime || {}
                                            surchargeBreakdown = breakdown.surcharges || {}
                                        } else {
                                            // Legacy: split manually
                                            Object.entries(breakdown).forEach(([key, val]) => {
                                                if (['extra_diurna', 'extra_nocturna', 'extra_diurna_festivo', 'extra_nocturna_festivo'].includes(key)) {
                                                    overtimeBreakdown[key] = val
                                                } else {
                                                    surchargeBreakdown[key] = val
                                                }
                                            })
                                        }

                                        const hasOvertime = Object.values(overtimeBreakdown).some(v => v > 0)
                                        const hasSurcharges = Object.values(surchargeBreakdown).some(v => v > 0)

                                        // Determine hourly rate
                                        let hourlyRate = 0
                                        const historySalary = empleado ? getSalaryForDate(empleado.hist_salarios, jornada.fecha) : null

                                        if (historySalary) {
                                            hourlyRate = Number(historySalary.hourlyRate)
                                        } else if (jornada.valor_hora_snapshot) {
                                            hourlyRate = Number(jornada.valor_hora_snapshot)
                                        } else if (empleado) {
                                            hourlyRate = Number(empleado.valor_hora)
                                        }

                                        let dayValue = 0
                                        if (hourlyRate > 0 && recargos.length > 0) {
                                            dayValue = calculateTotalOvertimeValue(flatBreakdown, hourlyRate, recargos)
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
                                                    {jornada.horas_para_bolsa_minutos > 0 && (
                                                        <div className="mt-1">
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                                Bolsa: {formatMinutesToFloat(jornada.horas_para_bolsa_minutos)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-foreground">
                                                    <div className="flex flex-col gap-1">
                                                        {schedule.morning.enabled && (
                                                            <span className="text-xs">M: {formatToAmPm(schedule.morning.start)}-{formatToAmPm(schedule.morning.end)}</span>
                                                        )}
                                                        {schedule.afternoon.enabled && (
                                                            <span className="text-xs">T: {formatToAmPm(schedule.afternoon.start)}-{formatToAmPm(schedule.afternoon.end)}</span>
                                                        )}
                                                        {!schedule.morning.enabled && !schedule.afternoon.enabled && (
                                                            <span className="text-xs italic text-muted-foreground">Sin turno</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {hasOvertime ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {Object.entries(overtimeBreakdown).map(([key, minutes]) => {
                                                                if (minutes <= 0) return null
                                                                return (
                                                                    <span key={key} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 mr-1 mb-1" title={LABELS[key]}>
                                                                        {LABELS[key]}: {formatMinutesToFloat(minutes)}
                                                                    </span>
                                                                )
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {hasSurcharges ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {Object.entries(surchargeBreakdown).map(([key, minutes]) => {
                                                                if (minutes <= 0) return null
                                                                return (
                                                                    <span key={key} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800 mr-1 mb-1" title={LABELS[key]}>
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
                                                    {['SOLICITADO', 'APROBADO'].includes(jornada.estado_compensacion) ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                                            En Bolsa
                                                        </span>
                                                    ) : (
                                                        dayValue > 0 ? formatCurrency(dayValue) : "-"
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
                )
            }

            {/* Details Modal */}
            {
                selectedJornada && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-card border border-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                                <h3 className="text-xl font-bold text-foreground">Detalles de la Jornada</h3>
                                <button
                                    onClick={() => setSelectedJornada(null)}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12" /></svg>
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
                                                    ? `${formatToAmPm(selectedJornada.jornada_base_calcular.morning.start)} - ${formatToAmPm(selectedJornada.jornada_base_calcular.morning.end)}`
                                                    : "No labora"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Tarde:</span>
                                            <span className="font-medium">
                                                {selectedJornada.jornada_base_calcular.afternoon.enabled
                                                    ? `${formatToAmPm(selectedJornada.jornada_base_calcular.afternoon.start)} - ${formatToAmPm(selectedJornada.jornada_base_calcular.afternoon.end)}`
                                                    : "No labora"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Desglose de Horas Extra</p>
                                    {(() => {
                                        const breakdown = selectedJornada.horas_extra_hhmm?.breakdown || {}
                                        let flatBreakdown = {}

                                        if (breakdown.overtime || breakdown.surcharges) {
                                            flatBreakdown = { ...breakdown.overtime, ...breakdown.surcharges }
                                        } else {
                                            flatBreakdown = breakdown
                                        }

                                        const hasItems = Object.values(flatBreakdown).some(v => v > 0)

                                        if (!hasItems) {
                                            return <p className="text-sm text-muted-foreground italic">No hay horas extra registradas</p>
                                        }

                                        return (
                                            <div className="space-y-2">
                                                {Object.entries(flatBreakdown).map(([key, val]) => {
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
                                        )
                                    })()}
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
                            <div className="p-4 bg-muted/30 border-t border-border flex justify-between items-center flex-wrap gap-2">
                                {/* Actions for User */}
                                {user && user.id === employeeId && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setShowAppealModal(true)
                                                setAppealDescription("")
                                                setAppealFiles([])
                                            }}
                                            className="px-4 py-2 bg-orange-500 text-white rounded-md text-sm font-medium hover:bg-orange-600 transition-colors"
                                        >
                                            Apelar
                                        </button>

                                        {/* Status Badge */}
                                        {(() => {
                                            const status = selectedJornada.estado_compensacion || 'NINGUNO'

                                            if (status !== 'NINGUNO') {
                                                return (
                                                    <span className="px-3 py-2 bg-blue-100 text-blue-800 rounded-md text-sm font-medium border border-blue-200">
                                                        {status === 'SOLICITADO' ? 'En Solicitud de Bolsa' : status === 'APROBADO' ? 'En Bolsa' : status}
                                                    </span>
                                                )
                                            }
                                            return null
                                        })()}
                                    </div>
                                )}
                                <button
                                    onClick={() => setSelectedJornada(null)}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity ml-auto"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Appeal Modal */}
            {
                showAppealModal && selectedJornada && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-border flex justify-between items-center bg-orange-50 dark:bg-orange-950/20">
                                <h3 className="text-xl font-bold text-foreground">Apelar Jornada</h3>
                                <button
                                    onClick={() => setShowAppealModal(false)}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-md p-3">
                                    <p className="text-sm text-orange-800 dark:text-orange-200">
                                        <strong>Jornada:</strong> {formatDateForDisplay(selectedJornada.fecha)}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                        Motivo de la apelación *
                                    </label>
                                    <textarea
                                        value={appealDescription}
                                        onChange={(e) => setAppealDescription(e.target.value)}
                                        placeholder="Describe por qué deseas apelar esta jornada..."
                                        rows={4}
                                        className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-2">
                                        Adjuntar archivos o fotos (opcional)
                                    </label>
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*,.pdf,.doc,.docx"
                                        onChange={(e) => setAppealFiles(Array.from(e.target.files || []))}
                                        className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90"
                                    />
                                    {appealFiles.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {appealFiles.map((file, idx) => (
                                                <div key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                                    <span className="truncate">{file.name}</span>
                                                    <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 bg-muted/30 border-t border-border flex justify-end gap-3">
                                <button
                                    onClick={() => setShowAppealModal(false)}
                                    className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={async () => {
                                        if (!appealDescription.trim()) {
                                            alert("Por favor, describe el motivo de tu apelación")
                                            return
                                        }

                                        try {
                                            // Create FormData for file upload
                                            const formData = new FormData()
                                            formData.append("jornada_id", selectedJornada.id)
                                            formData.append("motivo", appealDescription)

                                            // Append files
                                            appealFiles.forEach(file => {
                                                formData.append("files", file)
                                            })

                                            const response = await fetch("/api/apelaciones", {
                                                method: "POST",
                                                body: formData
                                            })

                                            const data = await response.json()

                                            if (response.ok) {
                                                alert(`✓ Apelación enviada exitosamente\n\nSu apelación ha sido registrada y será revisada por el equipo correspondiente.`)
                                                setShowAppealModal(false)
                                                setSelectedJornada(null)
                                                setAppealDescription("")
                                                setAppealFiles([])
                                            } else {
                                                alert(`Error al enviar apelación:\n${data.message || "Error desconocido"}`)
                                            }
                                        } catch (error) {
                                            console.error("Error submitting appeal:", error)
                                            alert("Error al enviar la apelación. Por favor, intente nuevamente.")
                                        }
                                    }}
                                    className="px-4 py-2 bg-orange-500 text-white rounded-md text-sm font-medium hover:bg-orange-600 transition-colors"
                                >
                                    Enviar Apelación
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            <CompensatoryRequestModal
                isOpen={showBankingModal}
                onClose={() => setShowBankingModal(false)}
                checkAvailable={(() => {
                    const totals = {}
                    jornadas.forEach(j => {
                        const breakdown = j.horas_extra_hhmm?.breakdown ||
                            j.horas_extra_hhmm?.flatBreakdown ||
                            j.horas_extra_hhmm?.breakdown_legacy || {}

                        let flat = {}
                        if (breakdown.overtime) {
                            Object.entries(breakdown.overtime).forEach(([k, v]) => flat[k] = (flat[k] || 0) + v)
                            if (breakdown.surcharges) Object.entries(breakdown.surcharges).forEach(([k, v]) => flat[k] = (flat[k] || 0) + v)
                        } else {
                            flat = breakdown
                        }

                        const banked = j.desglose_compensacion || {}

                        Object.entries(flat).forEach(([type, mins]) => {
                            const alreadyBanked = banked[type] || 0
                            const net = Math.max(0, mins - alreadyBanked)
                            totals[type] = (totals[type] || 0) + net
                        })
                    })
                    return totals
                })()}
                onConfirm={async (requests) => {
                    const res = await fetch("/api/compensatorios/acumular-batch", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ requests })
                    })
                    if (res.ok) {
                        alert("Solicitud procesada con éxito.")
                        fetchData()
                    } else {
                        const err = await res.json()
                        throw new Error(err.message || "Error")
                    }
                }}
            />

            <BalanceManagementModal
                isOpen={showManageModal}
                onClose={() => setShowManageModal(false)}
                employee={empleado}
                onUpdate={fetchData}
            />
        </div>
    )
}
