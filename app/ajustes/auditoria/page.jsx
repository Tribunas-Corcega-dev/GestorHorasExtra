"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useRouter } from "next/navigation"

export default function AuditoriaPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <AuditoriaContent />
            </Layout>
        </ProtectedRoute>
    )
}

function AuditoriaContent() {
    const { user } = useAuth()
    const router = useRouter()
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [filters, setFilters] = useState({
        entity: "",
        action: "",
    })
    const [selectedLog, setSelectedLog] = useState(null)

    useEffect(() => {
        if (user && user.rol !== "JEFE" && user.rol !== "TALENTO_HUMANO") {
            router.push("/ajustes")
        } else if (user) {
            fetchLogs()
        }
    }, [user, router, page, filters])

    async function fetchLogs() {
        setLoading(true)
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: "20",
                ...filters
            })
            const res = await fetch(`/api/auditoria?${queryParams}`)
            if (res.ok) {
                const data = await res.json()
                setLogs(data.logs)
                setTotalPages(data.totalPages)
            }
        } catch (error) {
            console.error("Error fetching logs:", error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Auditoría de Cambios</h1>

            {/* Filters */}
            <div className="bg-card border border-border p-4 rounded-lg mb-6 flex flex-wrap gap-4">
                <select
                    value={filters.entity}
                    onChange={(e) => { setFilters(prev => ({ ...prev, entity: e.target.value })); setPage(1) }}
                    className="bg-background border border-input rounded px-3 py-2 text-sm"
                >
                    <option value="">Todas las Entidades</option>
                    <option value="EMPLEADO">Empleado</option>
                    <option value="CONFIGURACION">Configuración</option>
                    <option value="APELACION">Apelación</option>
                </select>
                <select
                    value={filters.action}
                    onChange={(e) => { setFilters(prev => ({ ...prev, action: e.target.value })); setPage(1) }}
                    className="bg-background border border-input rounded px-3 py-2 text-sm"
                >
                    <option value="">Todas las Acciones</option>
                    <option value="CREATE">Crear</option>
                    <option value="UPDATE">Actualizar</option>
                    <option value="DELETE">Eliminar</option>
                    <option value="APPROVE">Aprobar</option>
                    <option value="REJECT">Rechazar</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3">Fecha</th>
                                <th className="px-6 py-3">Usuario</th>
                                <th className="px-6 py-3">Acción</th>
                                <th className="px-6 py-3">Entidad</th>
                                <th className="px-6 py-3">ID Objetivo</th>
                                <th className="px-6 py-3">Detalles</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-muted-foreground">
                                        Cargando registros...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-muted-foreground">
                                        No hay registros de auditoría.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-medium">{log.user_name || "Sistema"}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${log.action === 'CREATE' || log.action === 'APPROVE' ? 'bg-green-100 text-green-800' :
                                                    log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                                                        log.action === 'DELETE' || log.action === 'REJECT' ? 'bg-red-100 text-red-800' :
                                                            'bg-gray-100 text-gray-800'
                                                }`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium">{log.entity}</td>
                                        <td className="px-6 py-4 font-mono text-xs">{log.entity_id}</td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                className="text-primary hover:underline font-medium"
                                            >
                                                Ver cambios
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-border flex justify-between items-center">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                            Anterior
                        </button>
                        <span className="text-sm">Página {page} de {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                            Siguiente
                        </button>
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <h3 className="text-xl font-bold">Detalles del Cambio</h3>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="text-muted-foreground hover:text-foreground text-2xl"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                                <div>
                                    <span className="font-semibold block text-muted-foreground">Fecha:</span>
                                    {new Date(selectedLog.created_at).toLocaleString()}
                                </div>
                                <div>
                                    <span className="font-semibold block text-muted-foreground">Usuario:</span>
                                    {selectedLog.user_name}
                                </div>
                                <div>
                                    <span className="font-semibold block text-muted-foreground">Entidad:</span>
                                    {selectedLog.entity} ({selectedLog.entity_id})
                                </div>
                            </div>

                            <div className="bg-muted p-4 rounded-md overflow-x-auto">
                                <h4 className="font-semibold mb-2 text-sm">Cambios (JSON):</h4>
                                <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                                    {JSON.stringify(selectedLog.details, null, 2)}
                                </pre>
                            </div>
                        </div>

                        <div className="p-6 border-t border-border flex justify-end">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
