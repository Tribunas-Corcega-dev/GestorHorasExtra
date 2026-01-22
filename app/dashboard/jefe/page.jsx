"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canSeeAllEmployees } from "@/lib/permissions" // reused
import { useRouter } from "next/navigation"
import { ApprovalFormatModal } from "./components/ApprovalFormatModal"

export default function JefeDashboard() {
    return (
        <ProtectedRoute>
            <Layout>
                <JefeContent />
            </Layout>
        </ProtectedRoute>
    )
}

function JefeContent() {
    const { user } = useAuth()
    const [employees, setEmployees] = useState([])
    const [approvals, setApprovals] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedEmployee, setSelectedEmployee] = useState(null) // For modal

    // Period state (default to current quincena logic or just date range)
    // Simplified: 1-15 or 16-End
    const [period, setPeriod] = useState(() => {
        const now = new Date()
        const isFirstQ = now.getDate() <= 15
        return {
            start: new Date(now.getFullYear(), now.getMonth(), isFirstQ ? 1 : 16).toISOString().split('T')[0],
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] // Logic for end day needs fix for 15th
        }
    })

    // Correction for period logic
    useEffect(() => {
        const now = new Date()
        const isFirstQ = now.getDate() <= 15
        const y = now.getFullYear()
        const m = now.getMonth()
        if (isFirstQ) {
            setPeriod({
                start: `${y}-${String(m + 1).padStart(2, '0')}-01`,
                end: `${y}-${String(m + 1).padStart(2, '0')}-15`
            })
        } else {
            const lastDay = new Date(y, m + 1, 0).getDate()
            setPeriod({
                start: `${y}-${String(m + 1).padStart(2, '0')}-16`,
                end: `${y}-${String(m + 1).padStart(2, '0')}-${lastDay}`
            })
        }
    }, [])


    useEffect(() => {
        if (user && canSeeAllEmployees(user.rol)) {
            fetchData()
        }
    }, [user, period])

    const fetchData = async () => {
        setLoading(true)
        try {
            // 1. Fetch Employees
            const resEmp = await fetch("/api/empleados")
            const emps = await resEmp.json()

            // 2. Fetch Approvals for this period
            const resApp = await fetch(`/api/aprobaciones/firma?inicio=${period.start}&fin=${period.end}`)
            const apps = await resApp.json()

            setEmployees(emps)
            setApprovals(apps || [])
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const getApprovalStatus = (empId) => {
        const app = approvals.find(a => a.empleado_id === empId)
        return app ? { status: "APROBADO", ...app } : { status: "PENDIENTE" }
    }

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
                    <button onClick={fetchData} className="ml-2 bg-primary text-primary-foreground px-3 py-1 rounded text-sm">
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
                        {employees.map(emp => {
                            const { status, fecha_aprobacion } = getApprovalStatus(emp.id)
                            return (
                                <tr key={emp.id} className="hover:bg-accent/50">
                                    <td className="px-4 py-3 font-medium">{emp.nombre}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{emp.cedula || "-"}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${status === 'APROBADO' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {status}
                                        </span>
                                        {fecha_aprobacion && (
                                            <div className="text-[10px] text-muted-foreground mt-1">
                                                {new Date(fecha_aprobacion).toLocaleDateString()}
                                            </div>
                                        )}
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
                        })}
                    </tbody>
                </table>
            </div>

            {selectedEmployee && (
                <ApprovalFormatModal
                    isOpen={!!selectedEmployee}
                    onClose={() => { setSelectedEmployee(null); fetchData(); }} // Refresh on close to update status
                    employee={selectedEmployee}
                    period={period}
                    jefe={user}
                    existingApproval={getApprovalStatus(selectedEmployee.id).id ? getApprovalStatus(selectedEmployee.id) : null}
                />
            )}
        </div>
    )
}
