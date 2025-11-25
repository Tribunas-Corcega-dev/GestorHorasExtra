"use client"

import { useState, useEffect } from "react"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useAuth } from "@/hooks/useAuth"
import { canManageOvertime } from "@/lib/permissions"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ScheduleSelector } from "@/components/ScheduleSelector"

const AREA_MAPPING = {
    "Acueducto": "h_acueducto",
    "Alcantarillado": "h_alcantarillado",
    "Aseo": "h_aseo",
    "Operario Bocatoma": "h_op_bocatoma",
    "Administrativo": "h_admin",
    "Planta Tratamiento": "h_planta_tratamiento"
}

export default function HorariosPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <HorariosContent />
            </Layout>
        </ProtectedRoute>
    )
}

function HorariosContent() {
    const { user } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")

    const [dbRecord, setDbRecord] = useState(null)
    const [selectedArea, setSelectedArea] = useState("")
    const [schedule, setSchedule] = useState({})

    useEffect(() => {
        if (user && !canManageOvertime(user.rol)) {
            router.push("/dashboard")
        } else {
            fetchData()
        }
    }, [user, router])

    // Update schedule when area changes
    useEffect(() => {
        if (selectedArea && dbRecord) {
            const column = AREA_MAPPING[selectedArea]
            const areaSchedule = dbRecord[column]

            if (areaSchedule) {
                // Ensure it's an object (handle potential stringified JSON)
                let parsed = areaSchedule
                if (typeof parsed === 'string') {
                    try {
                        parsed = JSON.parse(parsed)
                    } catch (e) {
                        console.error("Error parsing schedule:", e)
                        parsed = {}
                    }
                }
                setSchedule(parsed)
            } else {
                // Default empty schedule if none exists
                setSchedule({})
            }
        }
    }, [selectedArea, dbRecord])

    async function fetchData() {
        try {
            const res = await fetch("/api/horarios")
            if (res.ok) {
                const data = await res.json()
                setDbRecord(data)
                // Select first area by default if not set
                if (!selectedArea) {
                    setSelectedArea(Object.keys(AREA_MAPPING)[0])
                }
            }
        } catch (err) {
            console.error("Error fetching schedules:", err)
            setError("No se pudo cargar la información.")
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit() {
        setError("")
        setSuccess("")
        setSaving(true)

        try {
            if (!selectedArea) throw new Error("Seleccione un área")

            const res = await fetch("/api/horarios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: dbRecord?.id,
                    areaColumn: AREA_MAPPING[selectedArea],
                    schedule: schedule
                }),
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.message || "Error al guardar")
            }

            const data = await res.json()
            setDbRecord(data) // Update local record
            setSuccess(`Horario para ${selectedArea} guardado exitosamente.`)
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
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/ajustes" className="text-muted-foreground hover:text-foreground">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </Link>
                <h1 className="text-3xl font-bold text-foreground">Horarios por Área</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar / Area Selector */}
                <div className="lg:col-span-1 space-y-2">
                    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                        <h3 className="font-semibold mb-4 text-foreground">Seleccionar Área</h3>
                        <div className="space-y-1">
                            {Object.keys(AREA_MAPPING).map((area) => (
                                <button
                                    key={area}
                                    onClick={() => {
                                        setSelectedArea(area)
                                        setSuccess("")
                                        setError("")
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedArea === area
                                        ? "bg-primary text-primary-foreground font-medium"
                                        : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                                        }`}
                                >
                                    {area}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content / Schedule Editor */}
                <div className="lg:col-span-3">
                    <div className="bg-card border border-border rounded-lg shadow-md p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-foreground">
                                Horario: {selectedArea}
                            </h2>
                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 font-medium text-sm"
                            >
                                {saving ? "Guardando..." : "Guardar Cambios"}
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="mb-4 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-4 py-3 rounded-md text-sm">
                                {success}
                            </div>
                        )}

                        <div className="border border-border rounded-lg p-4 bg-background">
                            <ScheduleSelector
                                value={schedule}
                                onChange={setSchedule}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
