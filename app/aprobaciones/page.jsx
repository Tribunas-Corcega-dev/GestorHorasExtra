"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageOvertime } from "@/lib/permissions"
import { formatDateForDisplay } from "@/lib/utils"
import { supabase } from "@/lib/supabaseClient"

export default function AprobacionesPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <AprobacionesContent />
            </Layout>
        </ProtectedRoute>
    )
}

function AprobacionesContent() {
    const { user } = useAuth()
    const [activeTab, setActiveTab] = useState("banking") // 'banking' or 'redemption'
    const [bankingRequests, setBankingRequests] = useState([])
    const [redemptionRequests, setRedemptionRequests] = useState([])
    const [loading, setLoading] = useState(true)

    const [processingId, setProcessingId] = useState(null)

    useEffect(() => {
        if (user && canManageOvertime(user.rol)) {
            fetchRequests()
        }
    }, [user])

    async function fetchRequests() {
        setLoading(true)
        try {
            const res = await fetch("/api/compensatorios/gestionar")
            if (res.ok) {
                const data = await res.json()
                setBankingRequests(data.banking || [])
                setRedemptionRequests(data.redemption || [])
            } else {
                console.error("Error fetching requests: Status", res.status)
            }
        } catch (error) {
            console.error("Error fetching requests:", error)
        } finally {
            setLoading(false)
        }
    }

    async function handleBankingAction(jornadaId, action) {
        if (processingId) return
        setProcessingId(jornadaId)
        try {
            const res = await fetch("/api/compensatorios/gestionar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: 'BANKING',
                    id: jornadaId,
                    action
                })
            })

            if (res.ok) {
                alert(`Solicitud ${action === 'APROBAR' ? 'aprobada' : 'rechazada'} exitosamente`)
                await fetchRequests()
            } else {
                const data = await res.json()
                alert("Error: " + data.message)
            }
        } catch (error) {
            console.error("Error processing banking request:", error)
            alert("Error al procesar la solicitud")
        } finally {
            setProcessingId(null)
        }
    }

    async function handleRedemptionAction(requestId, action) {
        if (processingId) return
        setProcessingId(requestId)
        try {
            const res = await fetch("/api/compensatorios/gestionar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: 'REDEMPTION',
                    id: requestId,
                    action
                })
            })

            if (res.ok) {
                alert(`Solicitud ${action === 'APROBAR' ? 'aprobada' : 'rechazada'} exitosamente`)
                await fetchRequests()
            } else {
                const data = await res.json()
                alert("Error: " + data.message)
            }
        } catch (error) {
            console.error("Error processing redemption request:", error)
            alert("Error al procesar la solicitud")
        } finally {
            setProcessingId(null)
        }
    }

    if (!canManageOvertime(user?.rol)) {
        return <div className="p-8 text-center text-muted-foreground">No tienes permisos para ver esta página.</div>
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Aprobaciones</h1>
                <p className="text-muted-foreground">Gestiona las solicitudes de tiempo compensatorio.</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border">
                <button
                    onClick={() => setActiveTab('banking')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'banking'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Solicitudes de Acumulación ({bankingRequests.length})
                </button>
                <button
                    onClick={() => setActiveTab('redemption')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'redemption'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Solicitudes de Tiempo Libre ({redemptionRequests.length})
                </button>
            </div>

            {loading ? (
                <div className="py-12 text-center">Cargando solicitudes...</div>
            ) : (
                <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                    {activeTab === 'banking' ? (
                        bankingRequests.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">No hay solicitudes de acumulación pendientes.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted text-foreground font-medium uppercase text-xs">
                                        <tr>
                                            <th className="px-4 py-3">Empleado</th>
                                            <th className="px-4 py-3">Fecha Jornada</th>
                                            <th className="px-4 py-3">Horas a Bolsa</th>
                                            <th className="px-4 py-3 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {bankingRequests.map(req => (
                                            <tr key={req.id} className="hover:bg-accent/50">
                                                <td className="px-4 py-3 font-medium text-foreground">
                                                    {req.usuario?.nombre || req.usuario?.username}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {formatDateForDisplay(req.fecha)}
                                                </td>
                                                <td className="px-4 py-3 text-foreground">
                                                    {Math.floor(req.horas_para_bolsa_minutos / 60)}h {req.horas_para_bolsa_minutos % 60}m
                                                </td>
                                                <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                    {processingId === req.id ? (
                                                        <button disabled className="px-4 py-1 bg-muted text-muted-foreground rounded text-xs font-bold cursor-not-allowed">
                                                            Cargando...
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleBankingAction(req.id, 'APROBAR')}
                                                                className="px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs font-bold transition-colors"
                                                            >
                                                                Aprobar
                                                            </button>
                                                            <button
                                                                onClick={() => handleBankingAction(req.id, 'RECHAZAR')}
                                                                className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs font-bold transition-colors"
                                                            >
                                                                Rechazar
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    ) : (
                        redemptionRequests.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">No hay solicitudes de tiempo libre pendientes.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted text-foreground font-medium uppercase text-xs">
                                        <tr>
                                            <th className="px-4 py-3">Empleado</th>
                                            <th className="px-4 py-3">Tipo</th>
                                            <th className="px-4 py-3">Fechas</th>
                                            <th className="px-4 py-3">Tiempo</th>
                                            <th className="px-4 py-3">Motivo</th>
                                            <th className="px-4 py-3 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {redemptionRequests.map(req => (
                                            <tr key={req.id} className="hover:bg-accent/50">
                                                <td className="px-4 py-3 font-medium text-foreground">
                                                    {req.usuario?.nombre || req.usuario?.username}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                        {req.tipo.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                                    Del: {new Date(req.fecha_inicio).toLocaleString()}<br />
                                                    Al: {new Date(req.fecha_fin).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-foreground font-bold">
                                                    {Math.floor(req.minutos_solicitados / 60)}h {req.minutos_solicitados % 60}m
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground italic truncate max-w-[150px]" title={req.motivo}>
                                                    {req.motivo || "-"}
                                                </td>
                                                <td className="px-4 py-3 text-right flex justify-end gap-2">
                                                    {processingId === req.id ? (
                                                        <button disabled className="px-4 py-1 bg-muted text-muted-foreground rounded text-xs font-bold cursor-not-allowed">
                                                            Cargando...
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={() => handleRedemptionAction(req.id, 'APROBAR')}
                                                                className="px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs font-bold transition-colors"
                                                            >
                                                                Aprobar
                                                            </button>
                                                            <button
                                                                onClick={() => handleRedemptionAction(req.id, 'RECHAZAR')}
                                                                className="px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs font-bold transition-colors"
                                                            >
                                                                Rechazar
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    )
}
