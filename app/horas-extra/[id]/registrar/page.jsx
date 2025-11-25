"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageOvertime } from "@/lib/permissions"
import { useRouter, useParams } from "next/navigation"
import { DailyScheduleSelector } from "@/components/DailyScheduleSelector"
import { calculateOvertimeForDay, getDayId, formatMinutesToHHMM } from "@/hooks/useOvertimeCalculator"

export default function RegistrarHorasExtraPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <RegistrarHorasExtraContent />
            </Layout>
        </ProtectedRoute>
    )
}

function RegistrarHorasExtraContent() {
    const params = useParams()
    const { user } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [empleado, setEmpleado] = useState(null)

    const [fecha, setFecha] = useState("")
    const [jornada, setJornada] = useState({
        enabled: true,
        morning: { start: "08:00", end: "12:00", enabled: true },
        afternoon: { start: "13:00", end: "17:00", enabled: true },
    })

    useEffect(() => {
        if (user && !canManageOvertime(user.rol)) {
            router.push("/dashboard")
        }
        if (params?.id) {
            fetchEmpleado()
        }
    }, [user, router, params?.id])

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

            // Calculate overtime
            let overtimeMinutes = 0
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
                    overtimeMinutes = calculateOvertimeForDay(jornada, fixedDay)
                }
            }

            const res = await fetch("/api/jornadas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    empleado_id: params.id,
                    fecha,
                    jornada_base_calcular: jornada,
                    horas_extra_hhmm: {
                        minutes: overtimeMinutes,
                        formatted: formatMinutesToHHMM(overtimeMinutes)
                    }
                }),
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.message || "Error al registrar jornada")
            }

            alert("Jornada registrada exitosamente")
            router.push("/horas-extra")
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
        return <div className="text-center py-8">Cargando...</div>
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-foreground">Registrar Horas Extra</h1>

            {empleado && (
                <div className="mb-6 bg-muted/30 p-4 rounded-lg border border-border">
                    <h2 className="font-semibold text-lg">{empleado.nombre || empleado.username}</h2>
                    <div className="text-sm text-muted-foreground">
                        {empleado.cargo} • {empleado.area}
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
                            max={new Date().toISOString().split("T")[0]}
                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Configuración de horario
                        </label>
                        <DailyScheduleSelector
                            value={jornada}
                            onChange={setJornada}
                            date={fecha}
                        />
                    </div>

                    {error && <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
                        >
                            {saving ? "Guardando..." : "Guardar Jornada"}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push("/horas-extra")}
                            className="px-6 py-2 border border-border rounded-md hover:bg-accent transition-colors text-foreground font-medium"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
