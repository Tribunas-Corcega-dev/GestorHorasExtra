"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageEmployees, isCoordinator } from "@/lib/permissions"
import { useRouter, useParams } from "next/navigation"

export default function DetalleEmpleadoPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <DetalleEmpleadoContent />
            </Layout>
        </ProtectedRoute>
    )
}

const DAYS = [
    { id: "lunes", label: "Lunes" },
    { id: "martes", label: "Martes" },
    { id: "miercoles", label: "Miércoles" },
    { id: "jueves", label: "Jueves" },
    { id: "viernes", label: "Viernes" },
    { id: "sabado", label: "Sábado" },
    { id: "domingo", label: "Domingo" },
]

function DetalleEmpleadoContent() {
    const params = useParams()
    const { user } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [empleado, setEmpleado] = useState(null)

    useEffect(() => {
        if (user && !canManageEmployees(user.rol) && !isCoordinator(user.rol)) {
            router.push("/dashboard")
        }
        if (params?.id) {
            fetchEmpleado()
        }
    }, [user, router, params?.id])

    async function fetchEmpleado() {
        try {
            const res = await fetch(`/api/empleados/${params.id}`)
            if (res.ok) {
                const data = await res.json()
                // Parse jornada_fija_hhmm if it's a string (handle potential double stringification)
                if (data.jornada_fija_hhmm) {
                    try {
                        let schedule = data.jornada_fija_hhmm
                        if (typeof schedule === 'string') {
                            schedule = JSON.parse(schedule)
                        }
                        // Check if it's STILL a string after first parse (double encoded)
                        if (typeof schedule === 'string') {
                            schedule = JSON.parse(schedule)
                        }
                        data.jornada_fija_hhmm = schedule
                    } catch (e) {
                        console.error("Error parsing schedule:", e)
                    }
                }
                setEmpleado(data)
            }
        } catch (error) {
            console.error("Error fetching employee:", error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <div className="text-center py-8">Cargando...</div>
    }

    if (!empleado) {
        return <div className="text-center py-8 text-muted-foreground">Empleado no encontrado</div>
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-foreground">Detalles del Empleado</h1>
                <button
                    onClick={() => router.back()}
                    className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors text-foreground text-sm font-medium"
                >
                    Volver
                </button>
            </div>

            <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                {/* Header / Banner */}
                <div className="bg-primary/10 p-8 flex flex-col items-center border-b border-border">
                    <div className="h-32 w-32 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-5xl font-bold mb-4 shadow-md">
                        {(empleado.nombre || empleado.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">{empleado.nombre || empleado.username}</h2>
                    <p className="text-muted-foreground font-medium">@{empleado.username}</p>
                    <div className="mt-4 flex gap-2">
                        <span className="px-3 py-1 bg-background rounded-full text-xs font-medium border border-border shadow-sm">
                            {empleado.cargo || "Sin cargo"}
                        </span>
                        <span className="px-3 py-1 bg-background rounded-full text-xs font-medium border border-border shadow-sm">
                            {empleado.area || "Sin área"}
                        </span>
                    </div>
                </div>

                {/* Details Content */}
                <div className="p-8 space-y-8">

                    {/* Info Laboral Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
                            Información Laboral
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-4 bg-background rounded-lg border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Rol en sistema</p>
                                <p className="font-medium text-foreground text-lg">{empleado.rol}</p>
                            </div>
                            <div className="p-4 bg-background rounded-lg border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Tipo de trabajador</p>
                                <p className="font-medium text-foreground text-lg">{empleado.tipo_trabajador || "-"}</p>
                            </div>
                            <div className="p-4 bg-background rounded-lg border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Salario Base</p>
                                <p className="font-medium text-foreground text-lg">
                                    {empleado.salario_base ? `$${Number(empleado.salario_base).toLocaleString()}` : "-"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Horario Semanal Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
                            Horario Semanal
                        </h3>
                        {empleado.jornada_fija_hhmm ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {DAYS.map((day) => {
                                    const daySchedule = empleado.jornada_fija_hhmm[day.id]
                                    const isDayEnabled = daySchedule?.enabled

                                    return (
                                        <div key={day.id} className={`p-3 rounded-md border ${isDayEnabled ? "border-border bg-card" : "border-border/50 bg-muted/30"}`}>
                                            <div className="font-medium text-sm mb-2 flex items-center justify-between">
                                                <span>{day.label}</span>
                                                {!isDayEnabled && <span className="text-xs text-muted-foreground italic">Descanso</span>}
                                            </div>

                                            {isDayEnabled ? (
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">M:</span>
                                                        <span className="font-medium">
                                                            {daySchedule.morning?.enabled
                                                                ? `${daySchedule.morning.start} - ${daySchedule.morning.end}`
                                                                : "No labora"}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">T:</span>
                                                        <span className="font-medium">
                                                            {daySchedule.afternoon?.enabled
                                                                ? `${daySchedule.afternoon.start} - ${daySchedule.afternoon.end}`
                                                                : "No labora"}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-xs text-muted-foreground italic text-center py-2">
                                                    No programado
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No hay horario fijo registrado</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
