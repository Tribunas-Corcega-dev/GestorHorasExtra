"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import Link from "next/link"

export default function ReporteHorasExtraPage() {
    const { user } = useAuth()
    const [reportData, setReportData] = useState([])
    const [filteredData, setFilteredData] = useState([])
    const [loading, setLoading] = useState(true)
    const [areaFilter, setAreaFilter] = useState("")
    const [areas, setAreas] = useState([])

    useEffect(() => {
        if (user) {
            if (user.rol === "COORDINADOR" && user.area) {
                setAreaFilter(user.area)
            }
            fetchReport()
        }
    }, [user])

    // Update filtered data when reportData or filters change
    useEffect(() => {
        if (reportData.length > 0) {
            // Extract unique areas for the filter dropdown
            const uniqueAreas = [...new Set(reportData.map(item => item.area).filter(Boolean))].sort()
            setAreas(uniqueAreas)

            // Client-side filtering (or API-side if we prefer refetching)
            // Since we established API filtering, let's use API filtering for strictness, but we can also filter client side for responsiveness if we loaded ALL.
            // Current approach: Fetch ALL for HR, then client filter? Or fetch with param?
            // The user request implies "Show only employees of their area".
            // Backend ALREADY enforces it for Coordinator.
            // For HR, they might want to see specific area.
            // Let's rely on backend filtering if the user selects an area, OR client side?
            // Client side is faster if we already have the data.
            // BUT, the Coordinator implementation forces backend filter.
            // So: Coordinator gets filtered data from backend. HR gets ALL data from backend.
            // HR can then client-filter the large list.

            let data = reportData
            if (areaFilter && user.rol !== "COORDINADOR") { // For coordinator, data is ALREADY filtered by backend
                data = data.filter(item => item.area === areaFilter)
            }
            setFilteredData(data)
        }
    }, [reportData, areaFilter, user])


    async function fetchReport() {
        setLoading(true)
        try {
            // For Coordinator, backend enforces area, so we don't strictly NEED to pass specific param unless we want to be explicit.
            // For HR, fetching without param = ALL data.
            const res = await fetch(`/api/reportes/horas-extra`)
            if (res.ok) {
                const data = await res.json()
                setReportData(data)
                setFilteredData(data)
            } else {
                const errorText = await res.text()
                console.error("Error fetching report:", res.status, res.statusText, errorText)
            }
        } catch (error) {
            console.error("Error executing fetch:", error)
        } finally {
            setLoading(false)
        }
    }

    // Helper to format minutes to HH:MM
    const formatMinutes = (minutes) => {
        if (!minutes) return "00:00"
        const h = Math.floor(minutes / 60)
        const m = Math.round(minutes % 60)
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
    }

    return (
        <ProtectedRoute allowedRoles={["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "COORDINADOR"]}>
            <Layout>
                <div className="p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <h1 className="text-2xl font-bold">Reporte de Horas Extra (Acumulado)</h1>
                        <Link href={user?.rol === "COORDINADOR" ? "/dashboard/coordinador" : "/dashboard/talento-humano"} className="text-sm text-blue-600 hover:underline">
                            &larr; Volver al Dashboard
                        </Link>
                    </div>

                    <div className="bg-card border border-border rounded-lg p-4 mb-6 flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
                        <div className="text-sm text-muted-foreground max-w-2xl">
                            <p>Este reporte muestra el balance acumulado de horas extra y recargos pendientes por compensar para cada empleado.</p>
                        </div>

                        {/* Area Filter */}
                        {user?.rol !== "COORDINADOR" && (
                            <div className="w-full md:w-64">
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                    Filtrar por Área
                                </label>
                                <select
                                    value={areaFilter}
                                    onChange={(e) => setAreaFilter(e.target.value)}
                                    className="w-full px-3 py-2 border border-input bg-background/50 rounded-md text-sm focus:ring-2 focus:ring-primary"
                                >
                                    <option value="">Todas las Áreas</option>
                                    {areas.map(area => (
                                        <option key={area} value={area}>{area}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                            <p className="text-muted-foreground animate-pulse">Cargando reporte consolidado...</p>
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No hay registros para los filtros seleccionados.</div>
                    ) : (
                        <div className="overflow-x-auto bg-white rounded-lg shadow">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Empleado</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Área</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">HED</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">HEN</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">HEDF</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">HENF</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">RN</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">RDO</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">RDON</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">Total HE</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Bolsa</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredData.map((row) => (
                                        <tr key={row.id}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Link href={`/horas-extra/${row.id}/historial`} className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline">
                                                    {row.nombre || row.username}
                                                </Link>
                                                <div className="text-xs text-gray-500">{row.cc}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.area}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{formatMinutes(row.totals.hed)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{formatMinutes(row.totals.hen)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{formatMinutes(row.totals.hedf)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{formatMinutes(row.totals.henf)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{formatMinutes(row.totals.rn)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{formatMinutes(row.totals.rdo)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{formatMinutes(row.totals.rdon)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900 bg-gray-50">{formatMinutes(row.totals.total)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${row.bolsa_balance > 0 ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                                                    {formatMinutes(row.bolsa_balance)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                                <Link href={`/horas-extra/${row.id}/historial`} className="text-blue-600 hover:text-blue-900 font-medium">
                                                    Ver Detalles
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Layout>
        </ProtectedRoute>
    )
}
