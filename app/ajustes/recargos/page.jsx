"use client"

import { useState, useEffect } from "react"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useAuth } from "@/hooks/useAuth"
import { canManageOvertime } from "@/lib/permissions"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function RecargosPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <RecargosContent />
            </Layout>
        </ProtectedRoute>
    )
}

function RecargosContent() {
    const { user } = useAuth()
    const router = useRouter()
    const [recargos, setRecargos] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [editingId, setEditingId] = useState(null)

    // Form state for editing
    const [editForm, setEditForm] = useState({
        tipo_hora_extra: "",
        recargo_percentage: ""
    })

    const [nightShiftModalOpen, setNightShiftModalOpen] = useState(false)
    const [nightShiftForm, setNightShiftForm] = useState({ start: "21:00", end: "06:00" })
    const [parametrosId, setParametrosId] = useState(null)
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear().toString())

    useEffect(() => {
        if (user && !canManageOvertime(user.rol)) {
            router.push("/dashboard")
        } else {
            fetchRecargos()
            fetchParametros()
        }
    }, [user, router])

    async function fetchParametros() {
        try {
            const res = await fetch("/api/parametros")
            if (res.ok) {
                const data = await res.json()
                if (data.id) {
                    setParametrosId(data.id)
                    setCurrentYear(data.anio_vigencia || new Date().getFullYear().toString())
                    if (data.jornada_nocturna) {
                        setNightShiftForm(data.jornada_nocturna)
                    }
                }
            }
        } catch (err) {
            console.error("Error fetching parametros:", err)
        }
    }

    async function saveNightShift() {
        try {
            const res = await fetch("/api/parametros", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: parametrosId,
                    anio_vigencia: currentYear,
                    jornada_nocturna: nightShiftForm
                })
            })

            if (res.ok) {
                setNightShiftModalOpen(false)
                // Optional: Show success message
            } else {
                const data = await res.json()
                setError(data.message || "Error al guardar jornada nocturna")
            }
        } catch (err) {
            console.error("Error saving night shift:", err)
            setError("Error al guardar cambios")
        }
    }

    async function fetchRecargos() {
        try {
            const res = await fetch("/api/recargos")
            if (res.ok) {
                const data = await res.json()
                setRecargos(data)
            } else {
                setError("Error al cargar los recargos")
            }
        } catch (err) {
            console.error("Error fetching recargos:", err)
            setError("No se pudo conectar con el servidor")
        } finally {
            setLoading(false)
        }
    }

    function startEditing(recargo) {
        setEditingId(recargo.id)
        setEditForm({
            tipo_hora_extra: recargo.tipo_hora_extra,
            // Convert float (0.25) to percentage (25) for display
            recargo_percentage: (recargo.recargo * 100).toFixed(2).replace(/\.00$/, "")
        })
    }

    function cancelEditing() {
        setEditingId(null)
        setEditForm({ tipo_hora_extra: "", recargo_percentage: "" })
        setError("")
    }

    async function saveEdit(id) {
        try {
            const percentage = parseFloat(editForm.recargo_percentage)
            if (isNaN(percentage) || percentage < 0) {
                setError("El porcentaje debe ser un número válido")
                return
            }

            // Convert percentage (25) back to float (0.25)
            const recargoValue = percentage / 100

            const res = await fetch("/api/recargos", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id,
                    tipo_hora_extra: editForm.tipo_hora_extra,
                    recargo: recargoValue
                })
            })

            if (res.ok) {
                const updatedRecargo = await res.json()
                setRecargos(prev => prev.map(r => r.id === id ? updatedRecargo : r))
                setEditingId(null)
                setError("")
            } else {
                const data = await res.json()
                setError(data.message || "Error al guardar cambios")
            }
        } catch (err) {
            console.error("Error saving recargo:", err)
            setError("Error al guardar cambios")
        }
    }

    if (!canManageOvertime(user?.rol)) return null

    if (loading) return <div className="text-center py-8">Cargando...</div>

    return (
        <div className="max-w-5xl mx-auto">
            {/* Night Shift Modal */}
            {nightShiftModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-card border border-border rounded-lg shadow-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4 text-foreground">Configurar Jornada Nocturna</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Define el rango horario que se considera como jornada nocturna.
                        </p>

                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Hora Inicio</label>
                                <input
                                    type="time"
                                    value={nightShiftForm.start}
                                    onChange={(e) => setNightShiftForm(prev => ({ ...prev, start: e.target.value }))}
                                    className="w-full px-3 py-2 border border-input rounded bg-background text-foreground"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Hora Fin</label>
                                <input
                                    type="time"
                                    value={nightShiftForm.end}
                                    onChange={(e) => setNightShiftForm(prev => ({ ...prev, end: e.target.value }))}
                                    className="w-full px-3 py-2 border border-input rounded bg-background text-foreground"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setNightShiftModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveNightShift}
                                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Link href="/ajustes" className="text-muted-foreground hover:text-foreground">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <h1 className="text-3xl font-bold text-foreground">Recargos Horas Extra</h1>
                </div>
                <button
                    onClick={() => setNightShiftModalOpen(true)}
                    className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:opacity-90 font-medium text-sm flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    Configurar Jornada Nocturna
                </button>
            </div>

            <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                {error && (
                    <div className="bg-destructive/10 text-destructive px-4 py-3 text-sm border-b border-destructive/20">
                        {error}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                            <tr>

                                <th className="px-6 py-3">Tipo de Hora Extra</th>
                                <th className="px-6 py-3 w-32 text-right">Recargo (%)</th>
                                <th className="px-6 py-3 w-32 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {recargos.map((recargo) => (
                                <tr key={recargo.id} className="bg-background hover:bg-accent/50 transition-colors">


                                    <td className="px-6 py-4">
                                        {editingId === recargo.id ? (
                                            <input
                                                type="text"
                                                value={editForm.tipo_hora_extra}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, tipo_hora_extra: e.target.value }))}
                                                className="w-full px-2 py-1 border border-input rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                                            />
                                        ) : (
                                            <span className="font-medium text-foreground">{recargo.tipo_hora_extra}</span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-right">
                                        {editingId === recargo.id ? (
                                            <div className="flex items-center justify-end gap-1">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={editForm.recargo_percentage}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, recargo_percentage: e.target.value }))}
                                                    className="w-20 px-2 py-1 text-right border border-input rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                                                />
                                                <span className="text-muted-foreground">%</span>
                                            </div>
                                        ) : (
                                            <span className="font-mono text-foreground">
                                                {(recargo.recargo * 100).toFixed(2).replace(/\.00$/, "")}%
                                            </span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-center">
                                        {editingId === recargo.id ? (
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => saveEdit(recargo.id)}
                                                    className="text-green-600 hover:text-green-700 p-1 rounded hover:bg-green-50"
                                                    title="Guardar"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={cancelEditing}
                                                    className="text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50"
                                                    title="Cancelar"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEditing(recargo)}
                                                className="text-primary hover:text-primary/80 font-medium text-sm hover:underline"
                                            >
                                                Editar
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
