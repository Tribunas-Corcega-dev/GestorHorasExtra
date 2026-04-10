"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"

import Link from "next/link"

function getInitialPeriod() {
    const now = new Date()
    const isFirstQ = now.getDate() <= 15
    const y = now.getFullYear()
    const m = now.getMonth() + 1

    if (isFirstQ) {
        return {
            start: `${y}-${String(m).padStart(2, "0")}-01`,
            end: `${y}-${String(m).padStart(2, "0")}-15`
        }
    }

    const lastDay = new Date(y, m, 0).getDate()
    return {
        start: `${y}-${String(m).padStart(2, "0")}-16`,
        end: `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    }
}

export default function ReporteHorasExtraPage() {
    const { user } = useAuth()
    const [reportData, setReportData] = useState([])
    const [filteredData, setFilteredData] = useState([])
    const [loading, setLoading] = useState(true)
    const [areaFilter, setAreaFilter] = useState("")
    const [areas, setAreas] = useState([])
    const [period, setPeriod] = useState(getInitialPeriod)

    useEffect(() => {
        if (user?.rol === "COORDINADOR" && user.area) {
            setAreaFilter(user.area)
        }
    }, [user])

    useEffect(() => {
        if (user) {
            fetchReport(period)
        }
    }, [user, period.start, period.end])

    // Update filtered data when reportData or filters change
    useEffect(() => {
        if (reportData.length > 0) {
            const uniqueAreas = [...new Set(reportData.map(item => item.area).filter(Boolean))].sort()
            setAreas(uniqueAreas)

            let data = reportData
            if (areaFilter && user?.rol !== "COORDINADOR") {
                data = data.filter(item => item.area === areaFilter)
            }
            setFilteredData(data)
            return
        }

        setAreas([])
        setFilteredData([])
    }, [reportData, areaFilter, user])

    async function fetchReport(currentPeriod) {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (currentPeriod?.start) params.set("inicio", currentPeriod.start)
            if (currentPeriod?.end) params.set("fin", currentPeriod.end)

            const query = params.toString()
            const res = await fetch(`/api/reportes/horas-extra${query ? `?${query}` : ""}`)

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

    const formatMinutes = (minutes) => {
        if (!minutes) return "00:00"
        const h = Math.floor(minutes / 60)
        const m = Math.round(minutes % 60)
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
    }

    return (
        <Layout>
            <div className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h1 className="text-2xl font-bold">Reporte de Horas Extra (Acumulado)</h1>
                    <Link href={user?.rol === "COORDINADOR" ? "/dashboard/coordinador" : "/dashboard/talento-humano"} className="text-sm text-blue-600 hover:underline">
                        &larr; Volver al Dashboard
                    </Link>
                </div>

                <div className="bg-card border border-border rounded-lg p-4 mb-6 flex flex-col gap-4">
                    <div className="text-sm text-muted-foreground max-w-2xl">
                        <p>Este reporte muestra el balance de horas extra y recargos por empleado, filtrado por periodo.</p>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 md:items-end md:justify-between">
                        <div className="flex gap-2 items-center bg-card p-2 rounded border border-border w-fit">
                            <span className="text-sm font-medium">Periodo:</span>
                            <input
                                type="date"
                                value={period.start}
                                onChange={(e) => setPeriod((prev) => ({ ...prev, start: e.target.value }))}
                                className="border rounded px-2 py-1 text-sm"
                            />
                            <span>-</span>
                            <input
                                type="date"
                                value={period.end}
                                onChange={(e) => setPeriod((prev) => ({ ...prev, end: e.target.value }))}
                                className="border rounded px-2 py-1 text-sm"
                            />
                        </div>

                        {user?.rol !== "COORDINADOR" && (
                            <div className="w-full md:w-64">
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                                    Filtrar por Area
                                </label>
                                <select
                                    value={areaFilter}
                                    onChange={(e) => setAreaFilter(e.target.value)}
                                    className="w-full px-3 py-2 border border-input bg-background/50 rounded-md text-sm focus:ring-2 focus:ring-primary"
                                >
                                    <option value="">Todas las Areas</option>
                                    {areas.map(area => (
                                        <option key={area} value={area}>{area}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Area</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">HED</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">HEN</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">HEDF</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">HENF</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">RN</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">RDO</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">RDON</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">Total HE</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Compensacion en Tiempo</th>
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
    )
}