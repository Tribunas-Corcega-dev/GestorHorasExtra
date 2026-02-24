"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"

import { useRouter } from "next/navigation"

export default function AuditoriaPage() {
    return (
        
            <Layout>
                <AuditoriaContent />
            </Layout>
        
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
    const [userMap, setUserMap] = useState({})
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
                if (data.userDirectory) {
                    setUserMap(data.userDirectory)
                }
            }
        } catch (error) {
            console.error("Error fetching logs:", error)
        } finally {
            setLoading(false)
        }
    }

    // --- Formatting Helpers ---

    const getUserName = (id) => userMap[id] || id || "Desconocido"

    const formatDate = (dateStr) => {
        if (!dateStr) return "-"
        return new Date(dateStr).toLocaleString('es-CO', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
    }

    const formatCurrency = (val) => {
        if (!val) return "$0"
        return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" }).format(val)
    }

    const formatMinutes = (mins) => {
        if (!mins) return "0h 0m"
        const h = Math.floor(mins / 60)
        const m = mins % 60
        return `${h}h ${m}m`
    }

    // --- Renderers ---

    const renderActionBadge = (action) => {
        const styles = {
            CREATE: "bg-green-100 text-green-800 border-green-200",
            UPDATE: "bg-blue-100 text-blue-800 border-blue-200",
            DELETE: "bg-red-100 text-red-800 border-red-200",
            APPROVE: "bg-emerald-100 text-emerald-800 border-emerald-200",
            REJECT: "bg-rose-100 text-rose-800 border-rose-200",
            LOGIN: "bg-gray-100 text-gray-800 border-gray-200",
            ACUMULAR_BOLSA: "bg-purple-100 text-purple-800 border-purple-200",
            REDENCION: "bg-amber-100 text-amber-800 border-amber-200"
        }
        const labelMap = {
            CREATE: "Creación",
            UPDATE: "Actualización",
            DELETE: "Eliminación",
            APPROVE: "Aprobación",
            REJECT: "Rechazo",
            ACUMULAR_BOLSA: "Acumular Tiempo",
            REDENCION: "Canjeo Tiempo"
        }
        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${styles[action] || "bg-gray-100 text-gray-800"}`}>
                {labelMap[action] || action}
            </span>
        )
    }

    const renderEntityDetails = (log) => {
        const { entity, details } = log

        switch (entity) {
            case "EMPLEADO":
                if (log.action === "UPDATE" && details.diff) {
                    const fields = Object.keys(details.diff)
                    if (fields.length === 0) return <span className="text-muted-foreground italic">Sin cambios visibles</span>

                    return (
                        <div className="text-sm">
                            <ul className="space-y-1">
                                {fields.map(field => {
                                    const { old: oldVal, new: newVal } = details.diff[field]
                                    let displayOld = oldVal
                                    let displayNew = newVal

                                    // Special formatting for currency fields
                                    if (['salario_base', 'bono'].includes(field)) {
                                        displayOld = formatCurrency(oldVal)
                                        displayNew = formatCurrency(newVal)
                                    }

                                    // Special formatting for foto_url
                                    if (field === 'foto_url') {
                                        return (
                                            <li key={field} className="flex flex-col gap-2 p-2 bg-muted/50 rounded border border-border">
                                                <span className="font-semibold capitalize text-muted-foreground">Foto de Perfil:</span>
                                                <div className="flex items-center gap-4">
                                                    <div className="relative group">
                                                        <span className="absolute -top-2 left-0 text-[10px] bg-red-100 text-red-800 px-1 rounded border border-red-200">Antes</span>
                                                        {oldVal ? (
                                                            <img src={oldVal} alt="Foto anterior" className="h-16 w-16 object-cover rounded-full border-2 border-red-200 opacity-60 grayscale" />
                                                        ) : (
                                                            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center border-2 border-red-200 border-dashed text-xs text-muted-foreground">Sin Foto</div>
                                                        )}
                                                    </div>
                                                    <div className="text-muted-foreground">→</div>
                                                    <div className="relative group">
                                                        <span className="absolute -top-2 left-0 text-[10px] bg-green-100 text-green-800 px-1 rounded border border-green-200">Después</span>
                                                        {newVal ? (
                                                            <img src={newVal} alt="Nueva foto" className="h-20 w-20 object-cover rounded-full border-2 border-green-500 shadow-sm" />
                                                        ) : (
                                                            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border-2 border-green-200 border-dashed text-xs text-muted-foreground">Eliminada</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </li>
                                        )
                                    }

                                    return (
                                        <li key={field} className="flex flex-col sm:flex-row sm:gap-2">
                                            <span className="font-semibold capitalize text-muted-foreground">{field.replace(/_/g, " ")}:</span>
                                            <span className="flex gap-2 items-center">
                                                <span className="line-through text-red-400 text-xs">{String(displayOld)}</span>
                                                <span>→</span>
                                                <span className="text-green-600 font-medium">{String(displayNew)}</span>
                                            </span>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    )
                } else if (log.action === "CREATE") {
                    return (
                        <div className="text-sm">
                            <span className="font-medium">{details.nombre}</span> <br />
                            <span className="text-muted-foreground">CC: {details.cc} | Rol: {details.rol}</span>
                        </div>
                    )
                }
                break;

            case "JORNADA":
                return (
                    <div className="text-sm">
                        <div className="font-medium text-foreground">Fecha: {details.fecha}</div>
                        {details.empleado_id && (
                            <div className="text-muted-foreground text-xs mb-1">
                                Emp: {getUserName(details.empleado_id)}
                            </div>
                        )}
                        {details.horas || details.new_horas ? (
                            <div className="grid grid-cols-2 gap-x-4 max-w-xs mt-1">
                                <span className="text-muted-foreground">Extras:</span>
                                <span>{formatMinutes(((details.horas || details.new_horas)?.minutes || 0))}</span>
                                <span className="text-muted-foreground">Recargos:</span>
                                <span>{formatMinutes(((details.horas || details.new_horas)?.surchargeMinutes || 0))}</span>
                            </div>
                        ) : null}
                        {details.observaciones && <div className="mt-1 text-xs italic">"{details.observaciones}"</div>}
                        {details.new_observaciones && <div className="mt-1 text-xs italic">Not: "{details.new_observaciones}"</div>}
                    </div>
                )

            case "BOLSA_HORAS":
                const minutes = details.minutos_acumulados || details.minutos_redimidos || 0
                return (
                    <div className="text-sm">
                        <div className="font-medium text-foreground flex items-center gap-2">
                            {log.action === 'ACUMULAR_BOLSA' ? (
                                <span className="text-green-600">+{formatMinutes(minutes)}</span>
                            ) : (
                                <span className="text-amber-600">-{formatMinutes(minutes)}</span>
                            )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                            Saldo final: {formatMinutes(details.saldo_resultante)}
                        </div>
                        {details.motivo && <div className="text-xs italic mt-1">"{details.motivo}"</div>}
                        {details.solicitado_por && <div className="text-xs mt-1 opacity-75">Por: {details.solicitado_por}</div>}
                    </div>
                )

            case "APELACION":
                return (
                    <div className="text-sm">
                        {log.action === 'CREATE' ? (
                            <>
                                <div><span className="font-medium">Jornada ID:</span> ...{details.jornada_id?.slice(-6)}</div>
                                <div className="italic">"{details.motivo}"</div>
                                {details.has_files && <span className="text-xs bg-blue-50 text-blue-600 px-1 rounded">📎 Adjuntos</span>}
                            </>
                        ) : (
                            <>
                                <div className="font-medium">Nuevo Estado: {details.new_status}</div>
                                <div className="text-xs text-muted-foreground">Rol autor: {details.user_role}</div>
                            </>
                        )}
                    </div>
                )

            case "CONFIGURACION":
                if (details.target === "PARAMETROS_GLOBALES") {
                    return (
                        <div className="text-sm">
                            <div className="font-medium">Año: {details.anio}</div>
                            <ul className="list-disc list-inside mt-1">
                                {details.updates && Object.entries(details.updates).map(([key, val]) => (
                                    <li key={key} className="text-xs">
                                        <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}: </span>
                                        <span className="font-medium">{val}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )
                } else if (details.target === "RECARGO") {
                    return (
                        <div className="text-sm">
                            <div className="font-medium">{details.tipo_hora_extra}</div>
                            <div className="text-xs">Nuevo Factor: <span className="font-bold">{details.nuevo_recargo}</span></div>
                        </div>
                    )
                }
                else if (details.target === "HORARIO_BASE") {
                    return (
                        <div className="text-sm">
                            <div className="font-medium">Área: {details.area}</div>
                            <div className="text-xs text-muted-foreground">Horario Actualizado</div>
                        </div>
                    )
                }
                break;
        }

        return <pre className="text-xs text-muted-foreground overflow-hidden max-h-20">{JSON.stringify(details, null, 2)}</pre>
    }

    return (
        <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-foreground">Auditoría de Cambios</h1>

            {/* Filters */}
            <div className="bg-card border border-border p-4 rounded-lg mb-6 flex flex-wrap gap-4 shadow-sm">
                <select
                    value={filters.entity}
                    onChange={(e) => { setFilters(prev => ({ ...prev, entity: e.target.value })); setPage(1) }}
                    className="bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50"
                >
                    <option value="">Todas las Entidades</option>
                    <option value="EMPLEADO">Empleado</option>
                    <option value="JORNADA">Jornada</option>
                    <option value="BOLSA_HORAS">Bolsa de Horas</option>
                    <option value="APELACION">Apelación</option>
                    <option value="CONFIGURACION">Configuración</option>
                </select>
                <select
                    value={filters.action}
                    onChange={(e) => { setFilters(prev => ({ ...prev, action: e.target.value })); setPage(1) }}
                    className="bg-background border border-input rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50"
                >
                    <option value="">Todas las Acciones</option>
                    <option value="CREATE">Crear</option>
                    <option value="UPDATE">Actualizar</option>
                    <option value="DELETE">Eliminar</option>
                    <option value="APPROVE">Aprobar</option>
                    <option value="REJECT">Rechazar</option>
                    <option value="ACUMULAR_BOLSA">Acumular Bolsa</option>
                    <option value="REDENCION">Canjear Bolsa</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted text-muted-foreground uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-3 whitespace-nowrap">Fecha / Actor</th>
                                <th className="px-6 py-3">Acción / Entidad</th>
                                <th className="px-6 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan="3" className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex justify-center items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                            Cargando registros...
                                        </div>
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="px-6 py-12 text-center text-muted-foreground italic">
                                        No se encontraron registros de auditoría.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-accent/50 transition-colors">

                                        {/* Column 1: Date & Actor */}
                                        <td className="px-6 py-4 align-top">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-foreground whitespace-nowrap">
                                                    {formatDate(log.created_at)}
                                                </span>
                                                <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                    <span className="text-xs">{log.user_name || "Sistema"}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Column 2: Action & Entity */}
                                        <td className="px-6 py-4 align-top">
                                            <div className="flex flex-col items-start gap-2">
                                                {renderActionBadge(log.action)}
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                                    {log.entity}
                                                    {log.entity_id && <span className="opacity-50">#{log.entity_id.slice(0, 6)}</span>}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Column 3: Actions */}
                                        <td className="px-6 py-4 align-middle text-right">
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                                                Ver Detalles
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
                    <div className="px-6 py-4 border-t border-border flex justify-between items-center bg-muted/20">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 bg-background border border-input rounded-md hover:bg-accent disabled:opacity-50 text-sm font-medium transition-colors"
                        >
                            Anterior
                        </button>
                        <span className="text-sm font-medium text-muted-foreground">Página {page} de {totalPages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 bg-background border border-input rounded-md hover:bg-accent disabled:opacity-50 text-sm font-medium transition-colors"
                        >
                            Siguiente
                        </button>
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">Detalles del Cambio</h3>
                                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                    <span>{formatDate(selectedLog.created_at)}</span>
                                    <span>•</span>
                                    <span>Por: {selectedLog.user_name || "Sistema"}</span>
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-full"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="space-y-6">
                                {/* Header Info */}
                                <div className="flex flex-wrap gap-4 items-center p-4 bg-muted/30 rounded-lg border border-border/50">
                                    <div>
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Acción</span>
                                        {renderActionBadge(selectedLog.action)}
                                    </div>
                                    <div className="h-8 w-px bg-border"></div>
                                    <div>
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Entidad</span>
                                        <div className="font-mono text-sm">{selectedLog.entity}</div>
                                    </div>
                                    <div className="h-8 w-px bg-border"></div>
                                    <div>
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">ID Ref</span>
                                        <div className="font-mono text-sm text-muted-foreground">{selectedLog.entity_id}</div>
                                    </div>
                                </div>

                                {/* Main Content */}
                                <div>
                                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                                        Resumen de Cambios
                                    </h4>
                                    <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
                                        {renderEntityDetails(selectedLog)}
                                    </div>
                                </div>

                                {/* Technical Details Toggle */}
                                <details className="group">
                                    <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground font-medium select-none">
                                        <svg className="w-4 h-4 transition-transform group-open:rotate-90" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                        Ver Datos Técnicos (JSON)
                                    </summary>
                                    <div className="mt-3">
                                        <pre className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto text-xs font-mono">
                                            {JSON.stringify(selectedLog.details, null, 2)}
                                        </pre>
                                    </div>
                                </details>
                            </div>
                        </div>

                        <div className="p-4 border-t border-border bg-muted/10 flex justify-end">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity text-sm font-medium"
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
