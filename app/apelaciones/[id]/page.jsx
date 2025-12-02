"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useRouter, useParams } from "next/navigation"
import { formatDateForDisplay } from "@/lib/utils"
import { formatMinutesToHHMM } from "@/hooks/useOvertimeCalculator"

export default function AppealDetailsPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <AppealDetailsContent />
            </Layout>
        </ProtectedRoute>
    )
}

function formatMinutesToFloat(minutes) {
    if (!minutes) return "0h"
    const hours = minutes / 60
    return `${parseFloat(hours.toFixed(2))}h`
}

function AppealDetailsContent() {
    const { user } = useAuth()
    const router = useRouter()
    const params = useParams()
    const [loading, setLoading] = useState(true)
    const [appeal, setAppeal] = useState(null)
    const [processing, setProcessing] = useState(false)
    const [expandedImage, setExpandedImage] = useState(null)

    useEffect(() => {
        // Only HR can access
        if (user && !["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "JEFE"].includes(user.rol)) {
            router.push("/dashboard")
            return
        }

        if (user && params?.id) {
            fetchAppealDetails()
        }
    }, [user, router, params?.id])

    async function fetchAppealDetails() {
        try {
            setLoading(true)
            const res = await fetch(`/api/apelaciones/${params.id}`)
            if (res.ok) {
                const data = await res.json()
                setAppeal(data)
            } else {
                console.error("Error fetching appeal details")
                router.push("/apelaciones")
            }
        } catch (error) {
            console.error("Error:", error)
            router.push("/apelaciones")
        } finally {
            setLoading(false)
        }
    }

    async function handleUpdateStatus(newStatus) {
        if (!confirm(`¿Está seguro de ${newStatus === "APROBADA" ? "aprobar" : "rechazar"} esta apelación?`)) {
            return
        }

        try {
            setProcessing(true)
            const res = await fetch(`/api/apelaciones/${params.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: newStatus })
            })

            const data = await res.json()

            if (res.ok) {
                alert(data.message)
                router.push("/apelaciones")
            } else {
                alert(`Error: ${data.message}`)
            }
        } catch (error) {
            console.error("Error:", error)
            alert("Error al actualizar la apelación")
        } finally {
            setProcessing(false)
        }
    }

    async function handleDownloadFile(filePath) {
        try {
            // For now, just show alert - implement actual download later
            alert(`Descargando: ${filePath}`)
        } catch (error) {
            console.error("Error downloading file:", error)
        }
    }

    if (loading) {
        return <div className="text-center py-8">Cargando...</div>
    }

    if (!appeal) {
        return <div className="text-center py-8">Apelación no encontrada</div>
    }

    const LABELS = {
        extra_diurna: "Extra Diurna",
        extra_nocturna: "Extra Nocturna",
        extra_diurna_festivo: "Extra Diurna Festivo",
        extra_nocturna_festivo: "Extra Nocturna Festivo",
        recargo_nocturno: "Recargo Nocturno",
        dominical_festivo: "Dominical/Festivo",
        recargo_nocturno_festivo: "Recargo Nocturno Festivo"
    }

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-foreground">Detalles de Apelación</h1>
                <button
                    onClick={() => router.push("/apelaciones")}
                    className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors text-foreground text-sm font-medium"
                >
                    Volver
                </button>
            </div>

            {/* Status Badge */}
            <div className="mb-6">
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${appeal.estado === "PENDIENTE"
                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                    : appeal.estado === "APROBADA"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                    {appeal.estado}
                </span>
            </div>

            <div className="grid gap-6">
                {/* Employee Information */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-foreground mb-4">Información del Empleado</h2>
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {appeal.empleado?.foto_url ? (
                                <img
                                    src={appeal.empleado.foto_url}
                                    alt={appeal.empleado.nombre || appeal.empleado.username}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span className="text-xl font-bold text-primary">
                                    {(appeal.empleado?.nombre || appeal.empleado?.username || "?").charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-foreground">
                                {appeal.empleado?.nombre || appeal.empleado?.username}
                            </h3>
                            <div className="text-sm text-muted-foreground space-y-1">
                                <p><span className="font-medium">CC:</span> {appeal.empleado?.cc || "No registrada"}</p>
                                <p><span className="font-medium">Área:</span> {appeal.empleado?.area || "No especificada"}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Jornada Information */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-foreground mb-4">Información de la Jornada</h2>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Fecha</p>
                            <p className="font-medium text-foreground">{formatDateForDisplay(appeal.jornada?.fecha)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Tipo de Día</p>
                            <p className="font-medium text-foreground">
                                {appeal.jornada?.es_festivo ? "Festivo" : "Ordinario"}
                            </p>
                        </div>
                    </div>

                    <div className="mb-4">
                        <p className="text-sm text-muted-foreground mb-2">Horario Base</p>
                        <div className="bg-muted/50 p-3 rounded-md text-sm space-y-1">
                            <div className="flex justify-between">
                                <span>Mañana:</span>
                                <span className="font-medium">
                                    {appeal.jornada?.jornada_base_calcular?.morning?.enabled
                                        ? `${appeal.jornada.jornada_base_calcular.morning.start} - ${appeal.jornada.jornada_base_calcular.morning.end}`
                                        : "No labora"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Tarde:</span>
                                <span className="font-medium">
                                    {appeal.jornada?.jornada_base_calcular?.afternoon?.enabled
                                        ? `${appeal.jornada.jornada_base_calcular.afternoon.start} - ${appeal.jornada.jornada_base_calcular.afternoon.end}`
                                        : "No labora"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {appeal.jornada?.horas_extra_hhmm && (
                        <div>
                            <p className="text-sm text-muted-foreground mb-2">Horas Extra Calculadas</p>
                            <div className="space-y-2">
                                {Object.entries(appeal.jornada.horas_extra_hhmm.breakdown || {}).map(([key, val]) => {
                                    if (val <= 0) return null
                                    return (
                                        <div key={key} className="flex justify-between text-sm border-b border-border/50 pb-1">
                                            <span className="text-muted-foreground">{LABELS[key]}</span>
                                            <span className="font-medium text-foreground">{formatMinutesToFloat(val)}</span>
                                        </div>
                                    )
                                })}
                                <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
                                    <span>Total</span>
                                    <span className="text-primary">{appeal.jornada.horas_extra_hhmm.formatted}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Appeal Information */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-foreground mb-4">Detalles de la Apelación</h2>
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Fecha de Apelación</p>
                            <p className="font-medium text-foreground">{formatDateForDisplay(appeal.fecha)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground mb-2">Motivo</p>
                            <p className="text-foreground bg-muted/30 p-3 rounded-md">{appeal.motivo}</p>
                        </div>
                        {appeal.files && appeal.files.length > 0 && (
                            <div>
                                <p className="text-sm text-muted-foreground mb-2">Archivos Adjuntos</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {appeal.files.map((file, idx) => (
                                        <div key={idx}>
                                            {file.isImage && file.url ? (
                                                <div
                                                    className="relative group cursor-pointer"
                                                    onClick={() => {
                                                        console.log("Image clicked:", file.name)
                                                        setExpandedImage(file)
                                                    }}
                                                >
                                                    <img
                                                        src={file.url}
                                                        alt={file.name}
                                                        className="w-full h-48 object-cover rounded-md border border-border hover:opacity-90 transition-opacity"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-md flex items-center justify-center pointer-events-none">
                                                        <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                                        </svg>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1 truncate">{file.name}</p>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between bg-muted/30 p-3 rounded-md">
                                                    <div className="flex items-center gap-2">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                                        <span className="text-sm font-medium truncate">{file.name}</span>
                                                    </div>
                                                    {file.url && (
                                                        <a
                                                            href={file.url}
                                                            download={file.name}
                                                            className="text-primary hover:text-primary/80 text-sm font-medium"
                                                        >
                                                            Descargar
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                {appeal.estado === "PENDIENTE" && (
                    <div className="flex gap-4">
                        <button
                            onClick={() => handleUpdateStatus("APROBADA")}
                            disabled={processing}
                            className="flex-1 bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
                        >
                            {processing ? "Procesando..." : "Aprobar Apelación"}
                        </button>
                        <button
                            onClick={() => handleUpdateStatus("RECHAZADA")}
                            disabled={processing}
                            className="flex-1 bg-red-600 text-white py-3 px-4 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 font-medium"
                        >
                            {processing ? "Procesando..." : "Rechazar Apelación"}
                        </button>
                    </div>
                )}
            </div>

            {/* Image Expand Modal */}
            {expandedImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
                    onClick={() => setExpandedImage(null)}
                >
                    <div className="relative w-full h-full flex flex-col items-center justify-center">
                        <button
                            onClick={() => setExpandedImage(null)}
                            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                        <img
                            src={expandedImage.url}
                            alt={expandedImage.name}
                            className="max-w-full max-h-[85vh] object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                        <p className="text-white text-center mt-4 text-sm max-w-2xl truncate">{expandedImage.name}</p>
                    </div>
                </div>
            )}
        </div>
    )
}
