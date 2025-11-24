"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageOvertime } from "@/lib/permissions"
import { useRouter } from "next/navigation"

export default function HorasExtraPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <HorasExtraContent />
            </Layout>
        </ProtectedRoute>
    )
}

function HorasExtraContent() {
    const { user } = useAuth()
    const router = useRouter()
    const [empleados, setEmpleados] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (user && !canManageOvertime(user.rol)) {
            router.push("/dashboard")
        }
    }, [user, router])

    useEffect(() => {
        fetchEmpleados()
    }, [])

    async function fetchEmpleados() {
        try {
            const res = await fetch("/api/empleados")
            if (res.ok) {
                const data = await res.json()
                setEmpleados(data)
            }
        } catch (error) {
            console.error("[v0] Error fetching employees:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleRegistrarHoras = (empleado) => {
        router.push(`/horas-extra/${empleado.id}/registrar`)
    }

    if (!canManageOvertime(user?.rol)) {
        return null
    }

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 text-foreground">Gestión de Horas Extra</h1>

            {loading ? (
                <div className="text-center py-8">Cargando...</div>
            ) : empleados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No se encontraron empleados</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {empleados.map((empleado) => (
                        <div key={empleado.id} className="bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col items-center text-center">
                            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                <span className="text-2xl font-bold text-primary">
                                    {(empleado.nombre || empleado.username || "?").charAt(0).toUpperCase()}
                                </span>
                            </div>

                            <h3 className="font-semibold text-lg text-foreground mb-1">
                                {empleado.nombre || empleado.username}
                            </h3>

                            <div className="text-sm text-muted-foreground mb-4 space-y-1">
                                <p>{empleado.cargo || "Sin cargo"}</p>
                                <p className="text-xs bg-muted px-2 py-1 rounded-full inline-block">
                                    {empleado.area || "Sin área"}
                                </p>
                            </div>

                            <div className="mt-auto w-full space-y-2">
                                <button
                                    onClick={() => handleRegistrarHoras(empleado)}
                                    className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                                >
                                    Registrar horas extra
                                </button>
                                <button
                                    onClick={() => router.push(`/horas-extra/${empleado.id}/historial`)}
                                    className="w-full bg-secondary text-secondary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity border border-border"
                                >
                                    Ver historial
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
