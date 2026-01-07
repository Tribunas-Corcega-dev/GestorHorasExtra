"use client"

import { useState, useEffect } from "react"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useAuth } from "@/hooks/useAuth"
import { canManageOvertime } from "@/lib/permissions"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function SalarioPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <SalarioContent />
            </Layout>
        </ProtectedRoute>
    )
}

function SalarioContent() {
    const { user } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    // Form state
    const [id, setId] = useState(null)
    const [salarioMinimo, setSalarioMinimo] = useState("")
    const [anioVigencia, setAnioVigencia] = useState(new Date().getFullYear().toString())
    const [limiteBolsaHoras, setLimiteBolsaHoras] = useState("") // New state

    useEffect(() => {
        if (user && !canManageOvertime(user.rol)) {
            router.push("/dashboard")
        } else {
            fetchData()
        }
    }, [user, router])

    async function fetchData() {
        try {
            const res = await fetch("/api/parametros")
            if (res.ok) {
                const data = await res.json()
                if (data && data.id) {
                    setId(data.id)
                    setSalarioMinimo(data.salario_minimo || "")
                    setAnioVigencia(data.anio_vigencia || new Date().getFullYear().toString())
                    setLimiteBolsaHoras(data.limite_bolsa_horas || "") // Load limit
                }
            }
        } catch (err) {
            console.error("Error fetching parameters:", err)
            setError("No se pudo cargar la información actual.")
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setError("")
        setSuccess("")
        setSaving(true)

        try {
            const res = await fetch("/api/parametros", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id,
                    salario_minimo: parseFloat(salarioMinimo),
                    anio_vigencia: anioVigencia,
                    limite_bolsa_horas: limiteBolsaHoras ? parseInt(limiteBolsaHoras) : null // Save limit
                }),
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.message || "Error al guardar")
            }

            const data = await res.json()
            setId(data.id)
            setSuccess("Configuración guardada exitosamente.")
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    if (!canManageOvertime(user?.rol)) {
        return null
    }

    if (loading) {
        return <div className="text-center py-8">Cargando...</div>
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/ajustes" className="text-muted-foreground hover:text-foreground">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </Link>
                <h1 className="text-3xl font-bold text-foreground">Parámetros Generales</h1>
            </div>

            <div className="bg-card border border-border rounded-lg shadow-md p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="salario" className="block text-sm font-medium text-foreground mb-2">
                            Salario Mínimo Legal Vigente
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                            <input
                                id="salario"
                                type="number"
                                value={salarioMinimo}
                                onChange={(e) => setSalarioMinimo(e.target.value)}
                                required
                                min="0"
                                step="0.01"
                                className="w-full pl-8 pr-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="0.00"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Ingrese el valor sin puntos ni comas (use punto para decimales).
                        </p>
                    </div>

                    <div>
                        <label htmlFor="limite" className="block text-sm font-medium text-foreground mb-2">
                            Límite Bolsa de Horas (Minutos)
                        </label>
                        <input
                            id="limite"
                            type="number"
                            value={limiteBolsaHoras}
                            onChange={(e) => setLimiteBolsaHoras(e.target.value)}
                            min="0"
                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="Ej: 2400 (40 horas)"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Máximo de minutos acumulables por empleado. Deje en blanco para ilimitado.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="anio" className="block text-sm font-medium text-foreground mb-2">
                            Año de Vigencia
                        </label>
                        <input
                            id="anio"
                            type="number"
                            value={anioVigencia}
                            onChange={(e) => setAnioVigencia(e.target.value)}
                            required
                            min="2000"
                            max="2100"
                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>

                    {error && (
                        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-4 py-3 rounded-md text-sm">
                            {success}
                        </div>
                    )}

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
                        >
                            {saving ? "Guardando..." : "Guardar Configuración"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
