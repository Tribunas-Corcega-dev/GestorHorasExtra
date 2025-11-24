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
                <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Nombre</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Cargo</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Área</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {empleados.map((empleado) => (
                                    <tr key={empleado.id} className="hover:bg-accent transition-colors">
                                        <td className="px-4 py-3 text-sm text-foreground">
                                            <div className="font-medium">{empleado.nombre || empleado.username}</div>
                                            <div className="text-xs text-muted-foreground">{empleado.username}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-foreground">{empleado.cargo || "-"}</td>
                                        <td className="px-4 py-3 text-sm text-foreground">{empleado.area || "-"}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <button
                                                onClick={() => handleRegistrarHoras(empleado)}
                                                className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-medium hover:opacity-90 transition-opacity"
                                            >
                                                Registrar horas extra
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
