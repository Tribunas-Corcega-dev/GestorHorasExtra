"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import Link from "next/link"

export default function ReporteHorasExtraPage() {
    const { user } = useAuth()
    const [reportData, setReportData] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchReport()
    }, [])

    async function fetchReport() {
        setLoading(true)
        try {
            const res = await fetch(`/api/reportes/horas-extra`)
            if (res.ok) {
                const data = await res.json()
                setReportData(data)
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
        <ProtectedRoute allowedRoles={["TALENTO_HUMANO", "ASISTENTE_GERENCIA"]}>
            <Layout>
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-2xl font-bold">Reporte de Horas Extra (Acumulado)</h1>
                        <Link href="/dashboard/talento-humano" className="text-sm text-blue-600 hover:underline">
                            &larr; Volver al Dashboard
                        </Link>
                    </div>

                    <div className="mb-4 text-sm text-gray-600">
                        <p>Este reporte muestra el balance acumulado de horas extra y recargos pendientes por compensar para cada empleado.</p>
                    </div>

                    {loading ? (
                        <div className="text-center py-8">Cargando reporte...</div>
                    ) : reportData.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No hay registros de horas extra acumuladas.</div>
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
                                    {reportData.map((row) => (
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
