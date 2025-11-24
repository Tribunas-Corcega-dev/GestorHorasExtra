"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageOvertime } from "@/lib/permissions"
import { useRouter, useParams } from "next/navigation"

export default function HistorialHorasExtraPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <HistorialContent />
            </Layout>
        </ProtectedRoute>
    )
}

function HistorialContent() {
    const params = useParams()
    const { user } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [empleado, setEmpleado] = useState(null)
    const [jornadas, setJornadas] = useState([])

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
        <div className="max-w-4xl mx-auto">
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
                                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Mañana</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Tarde</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {jornadas.map((jornada) => {
                                    const schedule = jornada.jornada_base_calcular
                                    return (
                                        <tr key={jornada.id} className="hover:bg-accent/50 transition-colors">
                                            <td className="px-4 py-3 text-sm text-foreground font-medium">
                                                {new Date(jornada.fecha).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-foreground">
                                                {schedule.dayOfWeek || "-"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-foreground">
                                                {schedule.morning.enabled ? (
                                                    <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded text-xs">
                                                        {schedule.morning.start} - {schedule.morning.end}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs italic">No labora</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-foreground">
                                                {schedule.afternoon.enabled ? (
                                                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded text-xs">
                                                        {schedule.afternoon.start} - {schedule.afternoon.end}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs italic">No labora</span>
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
