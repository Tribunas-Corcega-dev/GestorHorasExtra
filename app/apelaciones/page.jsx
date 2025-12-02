"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useRouter } from "next/navigation"
import { formatDateForDisplay } from "@/lib/utils"

export default function ApelacionesPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <ApelacionesContent />
            </Layout>
        </ProtectedRoute>
    )
}

function ApelacionesContent() {
    const { user } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [appeals, setAppeals] = useState([])
    const [filter, setFilter] = useState("PENDIENTE")

    useEffect(() => {
        // Only HR can access
        if (user && !["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "JEFE"].includes(user.rol)) {
            router.push("/dashboard")
            return
        }

        if (user) {
            fetchAppeals()
        }
    }, [user, router, filter])

    async function fetchAppeals() {
        try {
            setLoading(true)
            const res = await fetch(`/api/apelaciones?estado=${filter}`)
            if (res.ok) {
                const data = await res.json()
                setAppeals(data)
            } else {
                console.error("Error fetching appeals")
            }
        } catch (error) {
            console.error("Error:", error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <div className="text-center py-8">Cargando...</div>
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-foreground">Gestión de Apelaciones</h1>
            </div>

            {/* Filter Tabs */}
            <div className="mb-6 flex gap-2 border-b border-border">
                <button
                    onClick={() => setFilter("PENDIENTE")}
                    className={`px-4 py-2 font-medium transition-colors ${filter === "PENDIENTE"
                            ? "text-primary border-b-2 border-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    Pendientes
                </button>
                <button
                    onClick={() => setFilter("APROBADA")}
                    className={`px-4 py-2 font-medium transition-colors ${filter === "APROBADA"
                            ? "text-primary border-b-2 border-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    Aprobadas
                </button>
                <button
                    onClick={() => setFilter("RECHAZADA")}
                    className={`px-4 py-2 font-medium transition-colors ${filter === "RECHAZADA"
                            ? "text-primary border-b-2 border-primary"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    Rechazadas
                </button>
            </div>

            {/* Appeals List */}
            {appeals.length === 0 ? (
                <div className="text-center py-12 bg-card border border-border rounded-lg">
                    <p className="text-muted-foreground">
                        No hay apelaciones {filter.toLowerCase()}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {appeals.map((appeal) => (
                        <div
                            key={appeal.id}
                            className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4 flex-1">
                                    {/* Employee Photo */}
                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {appeal.empleado?.foto_url ? (
                                            <img
                                                src={appeal.empleado.foto_url}
                                                alt={appeal.empleado.nombre || appeal.empleado.username}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <span className="text-lg font-bold text-primary">
                                                {(appeal.empleado?.nombre || appeal.empleado?.username || "?").charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>

                                    {/* Appeal Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-semibold text-lg text-foreground">
                                                {appeal.empleado?.nombre || appeal.empleado?.username}
                                            </h3>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${appeal.estado === "PENDIENTE"
                                                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                                                    : appeal.estado === "APROBADA"
                                                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                                }`}>
                                                {appeal.estado}
                                            </span>
                                        </div>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                            <p>
                                                <span className="font-medium">CC:</span> {appeal.empleado?.cc || "No registrada"}
                                            </p>
                                            <p>
                                                <span className="font-medium">Área:</span> {appeal.empleado?.area || "No especificada"}
                                            </p>
                                            <p>
                                                <span className="font-medium">Jornada:</span> {formatDateForDisplay(appeal.jornada?.fecha)}
                                            </p>
                                            <p>
                                                <span className="font-medium">Fecha de apelación:</span> {formatDateForDisplay(appeal.fecha)}
                                            </p>
                                        </div>
                                        <p className="mt-3 text-sm text-foreground line-clamp-2">
                                            <span className="font-medium">Motivo:</span> {appeal.motivo}
                                        </p>
                                    </div>
                                </div>

                                {/* Action Button */}
                                <button
                                    onClick={() => router.push(`/apelaciones/${appeal.id}`)}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                                >
                                    Ver Detalles
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
