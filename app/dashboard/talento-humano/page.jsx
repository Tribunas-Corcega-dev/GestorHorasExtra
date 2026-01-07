"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import Link from "next/link"
import { CompensatoryTimeWidget } from "@/app/dashboard/components/CompensatoryTimeWidget"

export default function TalentoHumanoDashboard() {
    const { user } = useAuth()
    const title = user?.rol === "ASISTENTE_GERENCIA" ? "Dashboard Asistente de Gerencia" : "Dashboard Talento Humano"

    return (
        <ProtectedRoute allowedRoles={["TALENTO_HUMANO", "ASISTENTE_GERENCIA"]}>
            <Layout>
                <DashboardStats title={title} />
            </Layout>
        </ProtectedRoute>
    )
}

function DashboardStats({ title }) {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch("/api/empleados")
                if (res.ok) {
                    const empleados = await res.json()
                    setStats({
                        total: empleados.length,
                        byRol: empleados.reduce((acc, emp) => {
                            acc[emp.rol] = (acc[emp.rol] || 0) + 1
                            return acc
                        }, {}),
                        byArea: empleados.reduce((acc, emp) => {
                            if (emp.area) {
                                acc[emp.area] = (acc[emp.area] || 0) + 1
                            }
                            return acc
                        }, {}),
                    })
                }
            } catch (error) {
                console.error("[v0] Error fetching stats:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    if (loading) {
        return <div className="text-center py-8">Cargando...</div>
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold mb-6 text-foreground">{title}</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                    <CompensatoryTimeWidget />
                </div>
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Approvals Card */}
                    <div className="bg-card border border-border rounded-lg shadow-md p-6 flex flex-col justify-center items-center text-center">
                        <div className="h-12 w-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-lg font-bold text-foreground mb-2">Aprobaciones</h2>
                        <p className="text-sm text-muted-foreground mb-4">Gestiona compensatorios y permisos.</p>
                        <Link href="/aprobaciones" className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
                            Ir a Aprobaciones
                        </Link>
                    </div>

                    {/* Total de empleados */}
                    <div className="bg-card border border-border rounded-lg shadow-md p-6">
                        <h2 className="text-sm font-medium text-muted-foreground mb-2">Total de empleados</h2>
                        <p className="text-4xl font-bold text-foreground mb-4">{stats?.total || 0}</p>
                        <Link href="/empleados" className="text-primary hover:underline text-sm font-medium">
                            Ver empleados →
                        </Link>
                    </div>

                    {/* Por rol */}
                    {stats?.byRol && Object.keys(stats.byRol).length > 0 && (
                        <div className="bg-card border border-border rounded-lg shadow-md p-6">
                            <h2 className="text-sm font-medium text-muted-foreground mb-4">Por Rol</h2>
                            <div className="space-y-2">
                                {Object.entries(stats.byRol).map(([rol, count]) => (
                                    <div key={rol} className="flex justify-between">
                                        <span className="text-sm text-foreground">{rol}</span>
                                        <span className="text-sm font-semibold text-foreground">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Por área (Added missing section compared to Coordinator) */}
                    {stats?.byArea && Object.keys(stats.byArea).length > 0 && (
                        <div className="bg-card border border-border rounded-lg shadow-md p-6">
                            <h2 className="text-sm font-medium text-muted-foreground mb-4">Por Área</h2>
                            <div className="space-y-2">
                                {Object.entries(stats.byArea).map(([area, count]) => (
                                    <div key={area} className="flex justify-between">
                                        <span className="text-sm text-foreground">{area}</span>
                                        <span className="text-sm font-semibold text-foreground">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
