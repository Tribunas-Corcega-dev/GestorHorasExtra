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


                    {/* Total de empleados */}
                    <div className="bg-card border border-border rounded-lg shadow-md p-6">
                        <h2 className="text-sm font-medium text-muted-foreground mb-2">Total de empleados</h2>
                        <p className="text-4xl font-bold text-foreground mb-4">{stats?.total || 0}</p>
                        <div className="flex flex-col gap-2">
                            <Link href="/empleados" className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity w-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                Ver Empleados
                            </Link>
                            <Link href="/dashboard/talento-humano/horas-extra" className="flex items-center justify-center gap-2 border border-input bg-background hover:bg-accent text-foreground px-4 py-2 rounded-md text-sm font-medium transition-colors w-full">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Ver Horas Extra
                            </Link>
                        </div>
                    </div>


                </div>
            </div>
        </div>
    )
}
