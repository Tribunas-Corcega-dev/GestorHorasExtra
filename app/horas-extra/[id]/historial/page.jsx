"use client"

import { useState, useEffect } from "react"
import { useOvertimeCalculator } from "@/hooks/useOvertimeCalculator"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageOvertime } from "@/lib/permissions"
import { formatDateForDisplay } from "@/lib/utils"
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
    const [loadingEmp, setLoadingEmp] = useState(true)
    const [empleado, setEmpleado] = useState(null)

    // Use the calculator hook
    const { loading: loadingCalc, calculations, summary } = useOvertimeCalculator(params?.id)

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
            const empRes = await fetch(`/api/empleados/${params.id}`)
            if (empRes.ok) {
                const empData = await empRes.json()
                setEmpleado(empData)
            }
        } catch (error) {
            console.error("Error fetching employee:", error)
        } finally {
            setLoadingEmp(false)
        }
    }

    if (!canManageOvertime(user?.rol)) {
        return null
    }

    if (loadingEmp || loadingCalc) {
        return <div className="text-center py-8">Cargando...</div>
    }

    return (
        <div className="max-w-5xl mx-auto">
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

            {/* Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Horas Extra</h3>
                    <div className="text-3xl font-bold text-primary">{summary.totalOvertimeHours}</div>
                    <p className="text-xs text-muted-foreground mt-1">Acumulado total</p>
                </div>
            </div>

            {calculations.length === 0 ? (
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
                                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Horas Extra</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {calculations.map((item) => {
                                    const schedule = item.schedule
                                    return (
                                        <tr key={item.id} className="hover:bg-accent/50 transition-colors">
                                            <td className="px-4 py-3 text-sm text-foreground font-medium">
                                                {formatDateForDisplay(item.date)}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-foreground">
                                                {item.dayId ? item.dayId.charAt(0).toUpperCase() + item.dayId.slice(1) : "-"}
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
                                            <td className="px-4 py-3 text-sm font-bold text-primary">
                                                {item.formattedOvertime !== "00:00" ? (
                                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">
                                                        {item.formattedOvertime}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">-</span>
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
