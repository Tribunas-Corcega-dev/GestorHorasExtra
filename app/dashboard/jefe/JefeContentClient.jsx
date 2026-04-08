"use client"

import { useMemo, useState } from "react"
import { ApprovalFormatModal } from "./components/ApprovalFormatModal"
import useSWR from "swr"

const fetcher = async (url) => {
    const res = await fetch(url)
    const data = await res.json()

    if (!res.ok) {
        throw new Error(data?.message || `Request failed: ${res.status}`)
    }

    return data
}

function toArray(value) {
    return Array.isArray(value) ? value : []
}

export function JefeContentClient({ initialPeriod }) {
    const [period, setPeriod] = useState(initialPeriod)
    const [selectedEmployee, setSelectedEmployee] = useState(null)

    const { data: emps = [], isLoading: loadingEmps } = useSWR("/api/empleados", fetcher)
    const { data: activeIds = [], isLoading: loadingActive } = useSWR(
        `/api/reportes/empleados-activos?inicio=${period.start}&fin=${period.end}`,
        fetcher
    )

    const isLoading = loadingEmps || loadingActive

    const empsList = useMemo(() => toArray(emps), [emps])
    const activeIdsList = useMemo(() => toArray(activeIds), [activeIds])

    const activeIdsSet = new Set(activeIdsList)
    const activeEmployees = empsList.filter((e) => activeIdsSet.has(e.id))

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Formato de Horas Extra</h1>
                    <p className="text-muted-foreground">Panel de impresion para firma fisica</p>
                </div>
                <div className="flex gap-2 items-center bg-card p-2 rounded border border-border">
                    <span className="text-sm font-medium">Periodo:</span>
                    <input
                        type="date"
                        value={period.start}
                        onChange={(e) => setPeriod({ ...period, start: e.target.value })}
                        className="border rounded px-2 py-1 text-sm"
                    />
                    <span>-</span>
                    <input
                        type="date"
                        value={period.end}
                        onChange={(e) => setPeriod({ ...period, end: e.target.value })}
                        className="border rounded px-2 py-1 text-sm"
                    />
                </div>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-foreground font-medium uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">Empleado</th>
                            <th className="px-4 py-3">Cedula</th>
                            <th className="px-4 py-3 text-center">Estado</th>
                            <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {isLoading ? (
                            <tr>
                                <td colSpan="4" className="py-12 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                        <p className="text-muted-foreground text-sm">Cargando empleados...</p>
                                    </div>
                                </td>
                            </tr>
                        ) : activeEmployees.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="py-12 text-center text-muted-foreground">
                                    No se encontraron empleados con horas extra en este periodo.
                                </td>
                            </tr>
                        ) : (
                            activeEmployees.map((emp) => (
                                <tr key={emp.id} className="hover:bg-accent/50">
                                    <td className="px-4 py-3 font-medium">{emp.nombre}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{emp.cc || "-"}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">DISPONIBLE</span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => setSelectedEmployee(emp)}
                                            className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded border border-blue-200 transition-colors font-medium"
                                        >
                                            Ver Formato
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {selectedEmployee ? (
                <ApprovalFormatModal
                    isOpen={!!selectedEmployee}
                    onClose={() => setSelectedEmployee(null)}
                    employee={selectedEmployee}
                    period={period}
                />
            ) : null}
        </div>
    )
}
