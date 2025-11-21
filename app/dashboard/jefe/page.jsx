"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import Link from "next/link"

export default function JefeDashboard() {
    return (
        <ProtectedRoute allowedRoles={["JEFE"]}>
            <Layout>
                <DashboardStats title="Dashboard Jefe" />
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
        <div>
            <h1 className="text-3xl font-bold mb-6 text-foreground">{title}</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

                {/* Por área */}
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
    )
}
