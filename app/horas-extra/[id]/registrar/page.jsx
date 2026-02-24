"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"

import { canManageOvertime } from "@/lib/permissions"
// ... (previous imports)
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { DailyScheduleSelector } from "@/components/DailyScheduleSelector"
import { calculateOvertimeForDay, getDayId, formatMinutesToHHMM } from "@/hooks/useOvertimeCalculator"

export default function RegistrarHorasExtraPage() {
    return (
        
            <Layout>
                <RegistrarHorasExtraContent />
            </Layout>
        
    )
}

function RegistrarHorasExtraContent() {
    const params = useParams()
    const searchParams = useSearchParams()
    const editDate = searchParams.get("fecha")

    const { user } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [empleado, setEmpleado] = useState(null)

    const [fecha, setFecha] = useState(editDate || "")
    const [isEditMode, setIsEditMode] = useState(!!editDate)

    const [jornada, setJornada] = useState({
        enabled: true,
        morning: { start: "07:30", end: "12:00", enabled: true },
        afternoon: { start: "13:45", end: "17:00", enabled: true },
    })
    const [observaciones, setObservaciones] = useState("")

    // Mode Toggle State
    const [registrationMode, setRegistrationMode] = useState("exact")
    const [exactTime, setExactTime] = useState({ start: "17:00", end: "19:00", es_festivo: false })

    const [nightShiftRange, setNightShiftRange] = useState(null)

    // Auto-detect Sunday for Exact Mode
    useEffect(() => {
        if (fecha) {
            const date = new Date(fecha)
            if (date.getUTCDay() === 0) {
                setExactTime(prev => ({ ...prev, es_festivo: true }))
            }
        }
    }, [fecha])

    useEffect(() => {
        if (user && !canManageOvertime(user.rol)) {
            router.push("/dashboard")
        }
        if (params?.id) {
            fetchEmpleado()
            fetchParametros()

            if (editDate) {
                fetchExistingJornada(editDate)
            }
        }
    }, [user, router, params?.id, editDate])

    async function fetchExistingJornada(dateStr) {
        try {
            const res = await fetch(`/api/jornadas?empleado_id=${params.id}`)
            if (res.ok) {
                const data = await res.json()
                const found = data.find(j => j.fecha === dateStr)
                if (found) {
                    setJornada({
                        ...found.jornada_base_calcular,
                        es_festivo: found.es_festivo // Ensure festivo state is synced
                    })
                    setObservaciones(found.observaciones || "")
                }
            }
        } catch (err) {
            console.error("Error fetching existing jornada:", err)
        }
    }

    async function fetchParametros() {
        try {
            const res = await fetch("/api/parametros")
            if (res.ok) {
                const data = await res.json()
                if (data.jornada_nocturna) {
                    setNightShiftRange(data.jornada_nocturna)
                }
            }
        } catch (err) {
            console.error("Error fetching parametros:", err)
        }
    }

    async function fetchEmpleado() {
        try {
            const res = await fetch(`/api/empleados/${params.id}`)
            if (!res.ok) {
                throw new Error("No se pudo cargar el empleado")
            }
            const data = await res.json()
            setEmpleado(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setError("")
        setSaving(true)

        try {
            if (!fecha) {
                throw new Error("Debes seleccionar una fecha")
            }
            if (!observaciones || observaciones.trim() === "") {
                throw new Error("Debes ingresar un motivo o justificación")
            }

            // Calculate overtime
            let overtimeResults = {
                totalMinutes: 0,
                overtimeMinutes: 0,
                surchargeMinutes: 0,
                breakdown: { overtime: {}, surcharges: {} },
                flatBreakdown: {}
            }

            // Determine effective schedule based on mode
            let effectiveJornada = jornada
            if (registrationMode === "exact") {
                // ADDED: Calculate day of week for display
                const dateObj = new Date(fecha + 'T12:00:00')
                const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'long' })

                effectiveJornada = {
                    dayOfWeek: dayName.charAt(0).toUpperCase() + dayName.slice(1),
                    enabled: true,
                    es_festivo: exactTime.es_festivo,
                    morning: { start: exactTime.start, end: exactTime.end, enabled: true },
                    afternoon: { start: "", end: "", enabled: false }
                }
            }

            if (empleado && empleado.jornada_fija_hhmm) {
                let fixedSchedule = empleado.jornada_fija_hhmm
                if (typeof fixedSchedule === 'string') {
                    try {
                        fixedSchedule = JSON.parse(fixedSchedule)
                        if (typeof fixedSchedule === 'string') fixedSchedule = JSON.parse(fixedSchedule)
                    } catch (e) {
                        console.error("Error parsing fixed schedule:", e)
                        fixedSchedule = null
                    }
                }

                if (fixedSchedule) {
                    const dayId = getDayId(fecha)
                    const fixedDay = fixedSchedule[dayId]

                    // Use the new calculator signature
                    overtimeResults = calculateOvertimeForDay(
                        effectiveJornada,
                        fixedDay,
                        nightShiftRange,
                        registrationMode === "exact" ? exactTime.es_festivo : jornada.es_festivo
                    )
                }
            }

            // --- USER REQUEST: Delete old and create new to ensure fresh calculation/snapshot ---
            if (isEditMode) {
                const deleteRes = await fetch(`/api/jornadas?empleado_id=${params.id}&fecha=${fecha}`, {
                    method: "DELETE"
                })

                if (!deleteRes.ok) {
                    const deleteErr = await deleteRes.json()
                    throw new Error("Error al limpiar registro anterior: " + (deleteErr.message || "Desconocido"))
                }
            }

            const res = await fetch("/api/jornadas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    empleado_id: params.id,
                    fecha,
                    // Save the effective schedule used for calculation
                    jornada_base_calcular: effectiveJornada,
                    observaciones,
                    es_festivo: registrationMode === "exact" ? exactTime.es_festivo : jornada.es_festivo,
                    horas_extra_hhmm: {
                        minutes: overtimeResults.totalMinutes,
                        overtimeMinutes: overtimeResults.overtimeMinutes,
                        surchargeMinutes: overtimeResults.surchargeMinutes,
                        formatted: formatMinutesToHHMM(overtimeResults.totalMinutes),
                        breakdown: overtimeResults.breakdown,
                        fragments: overtimeResults.fragments,
                        flatBreakdown: overtimeResults.flatBreakdown
                    }
                }),
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.message || "Error al registrar jornada")
            }

            alert(isEditMode ? "Jornada actualizada exitosamente" : "Jornada registrada exitosamente")
            router.push(`/horas-extra/${params.id}/historial`)
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    if (!canManageOvertime(user?.rol)) {
        return null
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-muted-foreground animate-pulse">Cargando formulario...</p>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-foreground">
                {isEditMode ? "Editar Jornada" : "Registrar Horas Extra"}
            </h1>

            {empleado && (
                <div className="mb-6 bg-muted/30 p-4 rounded-lg border border-border flex items-center gap-4">
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
                        <h2 className="font-semibold text-lg">{empleado.nombre || empleado.username}</h2>
                        <div className="text-sm text-muted-foreground">
                            <p>CC: {empleado.cc || "No registrada"}</p>
                            <p>{empleado.area}</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-card border border-border rounded-lg shadow-md p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="fecha" className="block text-sm font-medium text-foreground mb-2">
                            Fecha de la jornada
                        </label>
                        <input
                            id="fecha"
                            type="date"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                            required
                            disabled={isEditMode} // Disable date change in edit mode to prevent pk conflict or confusion
                            max={new Date().toISOString().split("T")[0]}
                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Configuración de horario
                        </label>

                        {/* Mode Toggle */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-4 bg-muted/20 p-3 rounded-lg border border-border/50">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="mode"
                                    value="exact"
                                    checked={registrationMode === "exact"}
                                    onChange={(e) => setRegistrationMode(e.target.value)}
                                    className="text-primary focus:ring-primary"
                                />
                                <span className="font-medium">Registrar Hora Exacta</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="mode"
                                    value="full"
                                    checked={registrationMode === "full"}
                                    onChange={(e) => setRegistrationMode(e.target.value)}
                                    className="text-primary focus:ring-primary"
                                />
                                <span className="font-medium">Registrar Jornada Completa</span>
                            </label>
                        </div>

                        {registrationMode === "exact" ? (
                            <div className="p-4 border rounded-lg bg-card border-border space-y-4">
                                <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
                                    <div className="flex-1 w-full">
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Hora Inicio</label>
                                        <input
                                            type="time"
                                            value={exactTime.start}
                                            onChange={e => setExactTime({ ...exactTime, start: e.target.value })}
                                            className="w-full px-3 py-2 border border-input rounded bg-background text-foreground"
                                        />
                                    </div>
                                    <div className="flex-1 w-full">
                                        <label className="block text-xs font-medium mb-1 text-muted-foreground">Hora Fin</label>
                                        <input
                                            type="time"
                                            value={exactTime.end}
                                            onChange={e => setExactTime({ ...exactTime, end: e.target.value })}
                                            className="w-full px-3 py-2 border border-input rounded bg-background text-foreground"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-end">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={exactTime.es_festivo}
                                            onChange={e => setExactTime({ ...exactTime, es_festivo: e.target.checked })}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <span className="text-sm font-medium">Es Festivo / Domingo</span>
                                    </label>
                                </div>
                            </div>
                        ) : (
                            <DailyScheduleSelector
                                value={jornada}
                                onChange={setJornada}
                                date={fecha}
                            />
                        )}
                    </div>

                    <div>
                        <label htmlFor="observaciones" className="block text-sm font-medium text-foreground mb-2">
                            Observaciones / Justificación <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            id="observaciones"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            required
                            placeholder="Describa el motivo de las horas extra..."
                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px]"
                        />
                    </div>

                    {error && <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>}

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="w-full sm:w-auto px-6 py-2 border border-border rounded-md hover:bg-accent transition-colors text-foreground font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full sm:flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
                        >
                            {saving ? "Guardando..." : (isEditMode ? "Actualizar Jornada" : "Guardar Jornada")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
