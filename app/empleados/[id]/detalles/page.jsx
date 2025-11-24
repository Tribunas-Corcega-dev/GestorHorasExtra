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
        <div className="max-w-3xl mx-auto">
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

                {/* Details Grid */}
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
                            Información Laboral
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Rol en sistema</p>
                                <p className="font-medium text-foreground">{empleado.rol}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Tipo de trabajador</p>
                                <p className="font-medium text-foreground">{empleado.tipo_trabajador || "-"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Salario Base</p>
                                <p className="font-medium text-foreground">
                                    {empleado.salario_base ? `$${Number(empleado.salario_base).toLocaleString()}` : "-"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
                            Horario Fijo
                        </h3>
                        {empleado.jornada_fija_hhmm ? (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Mañana:</span>
                                    {empleado.jornada_fija_hhmm.morning?.enabled ? (
                                        <span className="font-medium text-foreground">
                                            {empleado.jornada_fija_hhmm.morning.start} - {empleado.jornada_fija_hhmm.morning.end}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground italic">No labora</span>
                                    )}
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Tarde:</span>
                                    {empleado.jornada_fija_hhmm.afternoon?.enabled ? (
                                        <span className="font-medium text-foreground">
                                            {empleado.jornada_fija_hhmm.afternoon.start} - {empleado.jornada_fija_hhmm.afternoon.end}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground italic">No labora</span>
                                    )}
                                </div>
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
