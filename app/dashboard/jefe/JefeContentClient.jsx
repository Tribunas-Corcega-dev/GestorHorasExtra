"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { ApprovalFormatModal } from "./components/ApprovalFormatModal"
import useSWR from "swr"

const fetcher = (url) => fetch(url).then((res) => res.json())

export function JefeContentClient({ initialPeriod }) {
    const { user } = useAuth()
    const [period, setPeriod] = useState(initialPeriod)
    const [selectedEmployee, setSelectedEmployee] = useState(null)

    // Parallel data fetching using SWR
    const { data: emps = [], isLoading: loadingEmps } = useSWR("/api/empleados", fetcher)
    const { data: apps = [], isLoading: loadingApps, mutate: mutateApps } = useSWR(
        `/api/aprobaciones/firma?inicio=${period.start}&fin=${period.end}`,
        fetcher
    )
    const { data: activeIds = [], isLoading: loadingActive } = useSWR(
        `/api/reportes/empleados-activos?inicio=${period.start}&fin=${period.end}`,
        fetcher
    )

    const isLoading = loadingEmps || loadingApps || loadingActive

    // js-index-maps: Create a Map for O(1) lookups instead of .find() in loops
    const approvalsMap = new Map()
    apps.forEach(app => {
        approvalsMap.set(app.empleado_id, app)
    })

    // js-set-map-lookups: Create a Set for active ids
    const activeIdsSet = new Set(activeIds)

    // js-combine-iterations: Filter employees efficiently
    const activeEmployees = emps.filter(
        e => activeIdsSet.has(e.id) || approvalsMap.has(e.id)
    )

    if (!user) return null

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Aprobación de Horas Extra</h1>
                    <p className="text-muted-foreground">Panel de Control para Jefes</p>
                </div>
                <div className="flex gap-2 items-center bg-card p-2 rounded border border-border">
                    <span className="text-sm font-medium">Período:</span>
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
                    <button onClick={() => mutateApps()} className="ml-2 bg-primary text-primary-foreground px-3 py-1 rounded text-sm">
                        Actualizar
                    </button>
                </div>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-foreground font-medium uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3">Empleado</th>
                            <th className="px-4 py-3">Cédula</th>
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
                            activeEmployees.map(emp => {
                                const appData = approvalsMap.get(emp.id)
                                const status = appData ? "APROBADO" : "PENDIENTE"
                                const fecha_aprobacion = appData?.fecha_aprobacion

                                return (
                                    <tr key={emp.id} className="hover:bg-accent/50">
                                        <td className="px-4 py-3 font-medium">{emp.nombre}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{emp.cc || "-"}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${status === 'APROBADO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {status}
                                            </span>
                                            {fecha_aprobacion ? (
                                                <div className="text-[10px] text-muted-foreground mt-1">
                                                    {new Date(fecha_aprobacion).toLocaleDateString()}
                                                </div>
                                            ) : null}
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
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {selectedEmployee ? (
                <ApprovalFormatModal
                    isOpen={!!selectedEmployee}
                    onClose={() => { 
                        setSelectedEmployee(null); 
                        mutateApps(); 
                    }}
                    employee={selectedEmployee}
                    period={period}
                    jefe={user}
                    existingApproval={approvalsMap.get(selectedEmployee.id) || null}
                />
            ) : null}
        </div>
    )
}
