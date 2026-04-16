"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { useRouter } from "next/navigation"
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

function formatMinutes(minutes) {
    if (!minutes) return "00:00"
    const h = Math.floor(minutes / 60)
    const m = Math.round(minutes % 60)
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

function formatCurrency(value) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Number(value) || 0)
}

function PrintPreviewModal({ isOpen, onClose, onConfirmPrint, period, rows }) {
    if (!isOpen) return null

    return (
        <div id="th-print-modal-root" className="fixed inset-0 z-50 bg-black/60 p-4 overflow-y-auto flex items-start justify-center">
            <style jsx global>{`
                @media print {
                    @page { size: A4 landscape; margin: 8mm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    header, aside, nav, .report-screen-content { display: none !important; }
                    main { padding: 0 !important; }
                    #th-print-modal-root {
                        position: static !important;
                        inset: auto !important;
                        z-index: auto !important;
                        display: block !important;
                        width: 100% !important;
                        background: white !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                    }
                    #th-print-preview {
                        position: static !important;
                        width: 100% !important;
                        max-width: none !important;
                        background: white;
                        padding: 0;
                        margin: 0;
                        border: 0;
                        border-radius: 0;
                        box-shadow: none;
                    }
                    .th-print-actions {
                        display: none !important;
                    }
                    #th-print-sheet {
                        width: 100%;
                        overflow: visible !important;
                    }
                    #th-print-sheet table {
                        width: 100%;
                        table-layout: fixed;
                        border-collapse: collapse;
                    }
                    #th-print-sheet th,
                    #th-print-sheet td {
                        font-size: 11px;
                        padding: 4px 6px;
                    }
                }
            `}</style>

            <div id="th-print-preview" className="bg-white w-full max-w-[1200px] rounded-lg shadow-2xl border border-gray-200 print:max-w-none print:rounded-none print:shadow-none print:border-0">
                <div className="th-print-actions p-6 border-b border-gray-200 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Vista previa de impresion</h2>
                        <p className="text-sm text-gray-600">Confirma la impresion del periodo seleccionado.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            Cerrar
                        </button>
                        <button
                            type="button"
                            onClick={onConfirmPrint}
                            className="px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90"
                        >
                            Confirmar impresion
                        </button>
                    </div>
                </div>

                <div id="th-print-sheet" className="p-6 print:p-0">
                    <div className="mb-4">
                        <h1 className="text-2xl font-bold text-gray-900">Reporte de Horas Extra</h1>
                        <p className="text-sm text-gray-600 mt-1">Periodo: {period.start} - {period.end}</p>
                    </div>

                    <div className="overflow-x-auto print:overflow-visible">
                        <table className="w-full divide-y divide-gray-200 text-sm table-fixed">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold text-gray-700 w-[22%]">Empleado</th>
                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">HED</th>
                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">HEN</th>
                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">HEDF</th>
                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">HENF</th>
                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">RN</th>
                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">RDO</th>
                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">RDON</th>
                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Total HE</th>
                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Compensacion</th>
                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Valor a Pagar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {rows.map((row) => (
                                    <tr key={row.id}>
                                        <td className="px-4 py-2">
                                            <div className="font-medium text-gray-900 leading-tight break-words">{row.nombre || row.username}</div>
                                            <div className="text-[11px] text-gray-500">{row.area || "Sin area"}</div>
                                            <div className="text-xs text-gray-500">{row.cc}</div>
                                        </td>
                                        <td className="px-4 py-2 text-right">{formatMinutes(row.totals.hed)}</td>
                                        <td className="px-4 py-2 text-right">{formatMinutes(row.totals.hen)}</td>
                                        <td className="px-4 py-2 text-right">{formatMinutes(row.totals.hedf)}</td>
                                        <td className="px-4 py-2 text-right">{formatMinutes(row.totals.henf)}</td>
                                        <td className="px-4 py-2 text-right">{formatMinutes(row.totals.rn)}</td>
                                        <td className="px-4 py-2 text-right">{formatMinutes(row.totals.rdo)}</td>
                                        <td className="px-4 py-2 text-right">{formatMinutes(row.totals.rdon)}</td>
                                        <td className="px-4 py-2 text-right font-semibold">{formatMinutes(row.totals.total)}</td>
                                        <td className="px-4 py-2 text-right">{formatMinutes(row.bolsa_balance)}</td>
                                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.valor_a_pagar)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}
export default function ReporteHorasExtraPage() {
    const { user } = useAuth()
    const router = useRouter()

    const [reportData, setReportData] = useState([])
    const [filteredData, setFilteredData] = useState([])
    const [loading, setLoading] = useState(true)
    const [areaFilter, setAreaFilter] = useState("")
    const [areas, setAreas] = useState([])
    const [period, setPeriod] = useState(getInitialPeriod)
    const [showPrintPreview, setShowPrintPreview] = useState(false)

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

    useEffect(() => {
        if (reportData.length > 0) {
            const uniqueAreas = [...new Set(reportData.map((item) => item.area).filter(Boolean))].sort()
            setAreas(uniqueAreas)

            let data = reportData
            if (areaFilter && user?.rol !== "COORDINADOR") {
                data = data.filter((item) => item.area === areaFilter)
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

    const openPrintPreview = () => {
        setShowPrintPreview(true)
    }

    const confirmPrint = () => {
        window.print()
    }

    return (
        <Layout>
            <div className="report-screen-content p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <h1 className="text-2xl font-bold">Reporte de Horas Extra</h1>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={openPrintPreview}
                            disabled={loading || filteredData.length === 0}
                            className="px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            Imprimir periodo
                        </button>
                        <Link href={user?.rol === "COORDINADOR" ? "/dashboard/coordinador" : "/dashboard/talento-humano"} className="text-sm text-blue-600 hover:underline">
                            &larr; Volver al Dashboard
                        </Link>
                    </div>
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
                                    {areas.map((area) => (
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
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">HED</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">HEN</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">HEDF</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">HENF</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">RN</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">RDO</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">RDON</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">Total HE</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Compensacion en Tiempo</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor a Pagar</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredData.map((row) => (
                                    <tr
                                        key={row.id}
                                        tabIndex={0}
                                        role="button"
                                        onClick={() => router.push(`/horas-extra/${row.id}/historial`)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault()
                                                router.push(`/horas-extra/${row.id}/historial`)
                                            }
                                        }}
                                        className="cursor-pointer hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-900">{row.nombre || row.username}</span>
                                            <div className="text-[11px] text-gray-400">{row.area || "Sin area"}</div>
                                            <div className="text-xs text-gray-500">{row.cc}</div>
                                        </td>
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-emerald-700">
                                            {formatCurrency(row.valor_a_pagar)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <PrintPreviewModal
                isOpen={showPrintPreview}
                onClose={() => setShowPrintPreview(false)}
                onConfirmPrint={confirmPrint}
                period={period}
                rows={filteredData}
            />
        </Layout>
    )
}