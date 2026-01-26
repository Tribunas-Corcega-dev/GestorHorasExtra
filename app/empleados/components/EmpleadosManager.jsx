"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { canManageEmployees, canManageOvertime, isCoordinator } from "@/lib/permissions"
import { calculateTotalMinutes, getIntervals, timeToMinutes, formatMinutesToHHMM } from "@/lib/calculations"

export function EmpleadosManager() {
    const { user } = useAuth()
    const router = useRouter()
    const [empleados, setEmpleados] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [areaFilter, setAreaFilter] = useState("")
    const [rolFilter, setRolFilter] = useState("")
    const [roles, setRoles] = useState([])
    const [areas, setAreas] = useState([])
    const [sortOrder, setSortOrder] = useState("asc")

    // Balance Modal State
    const [showBalanceModal, setShowBalanceModal] = useState(false)
    const [selectedEmployeeForBalance, setSelectedEmployeeForBalance] = useState(null)
    const [balanceData, setBalanceData] = useState(null)
    const [schedule, setSchedule] = useState(null)
    const [redeeming, setRedeeming] = useState(false)

    // Redemption Form State
    const [tipo, setTipo] = useState("DIA_COMPLETO")
    const [fechaSingle, setFechaSingle] = useState("")
    const [horaLlegada, setHoraLlegada] = useState("")
    const [horaSalida, setHoraSalida] = useState("")
    const [calculatedDisplay, setCalculatedDisplay] = useState("")
    const [redemptionForm, setRedemptionForm] = useState({
        fecha_inicio: "",
        fecha_fin: "",
        minutos: "",
        motivo: ""
    })

    useEffect(() => {
        fetchEmpleados()
        fetchRoles()
    }, [search, areaFilter, rolFilter])

    async function fetchEmpleados() {
        try {
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            if (areaFilter) params.append("area", areaFilter)
            if (rolFilter) params.append("rol", rolFilter)

            const res = await fetch(`/api/empleados?${params}`)
            if (res.ok) {
                const data = await res.json()
                setEmpleados(data)
                // Extract unique areas
                const uniqueAreas = [...new Set(data.map((e) => e.area).filter(Boolean))]
                setAreas(uniqueAreas)
            }
        } catch (error) {
            console.error("Error fetching employees:", error)
        } finally {
            setLoading(false)
        }
    }

    async function fetchRoles() {
        try {
            const res = await fetch("/api/roles")
            if (res.ok) {
                const data = await res.json()
                setRoles(data)
            }
        } catch (error) {
            console.error("Error fetching roles:", error)
        }
    }

    // --- Balance Logic ---
    async function fetchBalance(employeeId) {
        try {
            const res = await fetch(`/api/compensatorios/saldo?userId=${employeeId}`)
            if (res.ok) {
                const data = await res.json()
                setBalanceData(data)
                if (data.jornada_fija_hhmm) {
                    try {
                        const parsed = typeof data.jornada_fija_hhmm === 'string'
                            ? JSON.parse(data.jornada_fija_hhmm)
                            : data.jornada_fija_hhmm
                        setSchedule(parsed)
                    } catch (e) { console.error(e); setSchedule(null) }
                } else setSchedule(null)
            }
        } catch (error) { console.error(error) }
    }

    const handleOpenBalanceModal = async (empleado) => {
        setSelectedEmployeeForBalance(empleado)
        setBalanceData(null)
        setSchedule(null)
        setTipo("DIA_COMPLETO")
        setFechaSingle("")
        setHoraLlegada("")
        setHoraSalida("")
        setRedemptionForm({ fecha_inicio: "", fecha_fin: "", minutos: "", motivo: "" })
        setCalculatedDisplay("")
        setShowBalanceModal(true)
        await fetchBalance(empleado.id)
    }

    const getDaySchedule = (dateStr) => {
        if (!dateStr || !schedule) return null
        const dateObj = new Date(dateStr + 'T12:00:00')
        const dayIndex = dateObj.getDay()
        const daysMap = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
        return schedule[daysMap[dayIndex]]
    }

    const updateCalculatedValues = (minutes) => {
        setRedemptionForm(prev => ({ ...prev, minutos: minutes.toString() }))
        const hoursDecimal = (minutes / 60).toFixed(2)
        const hoursInt = Math.floor(minutes / 60)
        const minutesInt = minutes % 60
        setCalculatedDisplay(`${hoursDecimal}h (${hoursInt}h ${minutesInt}m)`)
    }

    const handleFullDayLogic = (dateStr) => {
        setFechaSingle(dateStr)
        if (!dateStr) return
        const daySchedule = getDaySchedule(dateStr)
        if (!daySchedule || !daySchedule.enabled) {
            alert("El empleado no tiene turno programado para este día.")
            updateCalculatedValues(0)
            return
        }
        const intervals = getIntervals(daySchedule)
        const totalMinutes = calculateTotalMinutes(intervals)
        updateCalculatedValues(totalMinutes)
        let startStr = "", endStr = ""
        if (daySchedule.morning?.enabled) {
            startStr = daySchedule.morning.start
            endStr = daySchedule.morning.end
        }
        if (daySchedule.afternoon?.enabled) {
            if (!startStr) startStr = daySchedule.afternoon.start
            endStr = daySchedule.afternoon.end
        }
        if (startStr && endStr) {
            setRedemptionForm(prev => ({ ...prev, fecha_inicio: `${dateStr}T${startStr}`, fecha_fin: `${dateStr}T${endStr}` }))
        }
    }

    const handleLateArrivalLogic = (dateStr, timeStr) => {
        setFechaSingle(dateStr); setHoraLlegada(timeStr)
        if (!dateStr || !timeStr) return
        const daySchedule = getDaySchedule(dateStr)
        if (!daySchedule || !daySchedule.enabled) return
        const startTime = daySchedule.morning?.start || daySchedule.afternoon?.start
        if (!startTime) return
        const intervals = getIntervals(daySchedule)
        if (intervals.length === 0) return
        const firstStart = intervals[0].start
        const arrivalMin = timeToMinutes(timeStr)
        let missedMinutes = 0
        for (const interval of intervals) {
            const overlapStart = Math.max(interval.start, firstStart)
            const overlapEnd = Math.min(interval.end, arrivalMin)
            if (overlapStart < overlapEnd) missedMinutes += (overlapEnd - overlapStart)
        }
        updateCalculatedValues(missedMinutes)
        setRedemptionForm(prev => ({ ...prev, fecha_inicio: `${dateStr}T${startTime}`, fecha_fin: `${dateStr}T${timeStr}` }))
    }

    const handleEarlyDepartureLogic = (dateStr, timeStr) => {
        setFechaSingle(dateStr); setHoraSalida(timeStr)
        if (!dateStr || !timeStr) return
        const daySchedule = getDaySchedule(dateStr)
        if (!daySchedule || !daySchedule.enabled) return
        const intervals = getIntervals(daySchedule)
        if (intervals.length === 0) return
        const lastEnd = intervals[intervals.length - 1].end
        const exitMin = timeToMinutes(timeStr)
        let missedMinutes = 0
        for (const interval of intervals) {
            const overlapStart = Math.max(interval.start, exitMin)
            const overlapEnd = Math.min(interval.end, lastEnd)
            if (overlapStart < overlapEnd) missedMinutes += (overlapEnd - overlapStart)
        }
        updateCalculatedValues(missedMinutes)
        setRedemptionForm(prev => ({ ...prev, fecha_inicio: `${dateStr}T${timeStr}`, fecha_fin: `${dateStr}T${formatMinutesToHHMM(lastEnd)}` }))
    }

    async function handleManagerRedemption(e) {
        e.preventDefault()
        if (!redemptionForm.minutos || parseInt(redemptionForm.minutos) <= 0) return alert("Cantidad de tiempo inválida")
        if (!redemptionForm.motivo) return alert("Ingresa un motivo")
        try {
            setRedeeming(true)
            const res = await fetch("/api/compensatorios/solicitar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetUserId: selectedEmployeeForBalance.id,
                    tipo: tipo,
                    fecha_inicio: redemptionForm.fecha_inicio,
                    fecha_fin: redemptionForm.fecha_fin,
                    minutos_solicitados: parseInt(redemptionForm.minutos),
                    motivo: redemptionForm.motivo
                })
            })
            const data = await res.json()
            if (res.ok) {
                alert("Canjeo realizado exitosamente")
                await fetchBalance(selectedEmployeeForBalance.id)
                setTipo("DIA_COMPLETO"); setFechaSingle(""); setHoraLlegada(""); setHoraSalida("")
                setRedemptionForm({ fecha_inicio: "", fecha_fin: "", minutos: "", motivo: "" }); setCalculatedDisplay("")
            } else alert("Error: " + data.message)
        } catch (error) { console.error(error); alert("Error al procesar el canjeo") } finally { setRedeeming(false) }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-foreground">Gestión de Personal</h1>
                {canManageEmployees(user?.rol) && (
                    <Link
                        href="/empleados/nuevo"
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity font-medium"
                    >
                        Nuevo Empleado
                    </Link>
                )}
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Buscar por nombre o usuario"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <select
                    value={areaFilter}
                    onChange={(e) => setAreaFilter(e.target.value)}
                    className="px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <option value="">Todas las áreas</option>
                    {areas.map((area) => <option key={area} value={area}>{area}</option>)}
                </select>
                <select
                    value={rolFilter}
                    onChange={(e) => setRolFilter(e.target.value)}
                    className="px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <option value="">Todos los roles</option>
                    {roles.map((rol) => <option key={rol} value={rol}>{rol}</option>)}
                </select>
            </div>

            {/* Lista Unificada */}
            {loading ? (
                <div className="text-center py-8">Cargando...</div>
            ) : empleados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No se encontraron empleados</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {empleados
                        .sort((a, b) => {
                            const nameA = (a.nombre || a.username || "").trim().toLowerCase()
                            const nameB = (b.nombre || b.username || "").trim().toLowerCase()
                            return sortOrder === "asc"
                                ? nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
                                : nameB.localeCompare(nameA, 'es', { sensitivity: 'base' })
                        })
                        .map((empleado) => (
                            <div key={empleado.id} className="bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-all p-6 relative group">
                                <div className="flex items-start gap-4 mb-4">
                                    <div
                                        onClick={() => router.push(`/empleados/${empleado.id}/detalles`)}
                                        className="h-16 w-16 min-w-[4rem] rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                        title="Ver Detalles"
                                    >
                                        {empleado.foto_url ? (
                                            <img src={empleado.foto_url} alt={empleado.nombre} className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-xl font-bold text-primary">
                                                {(empleado.nombre || empleado.username || "?").charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-lg text-foreground uppercase leading-tight truncate">
                                            {empleado.nombre || empleado.username}
                                        </h3>
                                        <p className="text-muted-foreground text-sm">@{empleado.username}</p>
                                        <p className="text-muted-foreground text-sm">CC: {empleado.cc || "N/A"}</p>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-6">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Área:</span>
                                        <span className="font-medium text-foreground text-right">{empleado.area || "Sin área"}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">Rol:</span>
                                        <span className="bg-muted px-2 py-0.5 rounded text-xs font-semibold uppercase">{empleado.rol}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-auto">
                                    {/* Botones de Gestión de Horas (Solo para roles con permiso) */}
                                    {canManageOvertime(user?.rol) && (
                                        <>
                                            <button
                                                onClick={() => router.push(`/horas-extra/${empleado.id}/registrar`)}
                                                className="col-span-1 bg-foreground text-background hover:bg-foreground/90 py-2 rounded-md text-sm font-medium transition-colors border border-foreground"
                                            >
                                                Registrar
                                            </button>
                                            <button
                                                onClick={() => router.push(`/horas-extra/${empleado.id}/historial`)}
                                                className="col-span-1 bg-background text-foreground hover:bg-accent py-2 rounded-md text-sm font-medium transition-colors border border-input"
                                            >
                                                Historial HE
                                            </button>
                                            <button
                                                onClick={() => handleOpenBalanceModal(empleado)}
                                                className="col-span-2 bg-muted hover:bg-muted/80 text-foreground py-2 rounded-md text-sm font-medium transition-colors border border-transparent flex items-center justify-center gap-2"
                                            >
                                                Gestionar Bolsa
                                            </button>
                                        </>
                                    )}

                                    {/* Botones Básicos (Visible para todos los managers/coordinadores o solo jefe) */}
                                    {(!canManageOvertime(user?.rol) && canManageEmployees(user?.rol)) && (
                                        <button
                                            onClick={() => router.push(`/horas-extra/${empleado.id}/historial`)}
                                            className="col-span-2 bg-background text-foreground hover:bg-accent py-2 rounded-md text-sm font-medium transition-colors border border-input"
                                        >
                                            Ver Historial HE
                                        </button>
                                    )}

                                    {/* Botón Editar (Solo Admin/TH) */}
                                    {canManageEmployees(user?.rol) && (
                                        <button
                                            onClick={() => router.push(`/empleados/${empleado.id}`)}
                                            className="col-span-2 flex items-center justify-center gap-1 py-2 text-primary hover:text-primary/80 transition-colors text-sm font-medium border-t border-border mt-1"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Editar Perfil
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                </div>
            )}

            {/* Balance Modal */}
            {showBalanceModal && selectedEmployeeForBalance && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-blue-50 dark:bg-blue-950/20">
                            <div>
                                <h3 className="text-xl font-bold text-foreground">Gestión de Bolsa de Horas</h3>
                                <p className="text-sm text-muted-foreground">Empleado: <span className="font-medium text-foreground">{selectedEmployeeForBalance.nombre || selectedEmployeeForBalance.username}</span></p>
                            </div>
                            <button onClick={() => setShowBalanceModal(false)} className="text-muted-foreground hover:text-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></button>
                        </div>
                        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
                            <div className="md:col-span-2 flex flex-col overflow-hidden">
                                <div className="p-4 bg-muted/20 border-b border-border"><h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Historial</h4></div>
                                <div className="flex-1 overflow-y-auto p-0"><table className="w-full text-sm"><thead className="bg-muted text-muted-foreground sticky top-0"><tr><th className="px-4 py-2 text-left">Fecha</th><th className="px-4 py-2 text-left">Concepto</th><th className="px-4 py-2 text-right">Cant.</th><th className="px-4 py-2 text-right">Saldo</th></tr></thead><tbody className="divide-y divide-border">{balanceData?.historial?.map((item) => (<tr key={item.id} className="hover:bg-accent/50"><td className="px-4 py-3 text-muted-foreground">{new Date(item.fecha).toLocaleDateString()}</td><td className="px-4 py-3"><p className="font-medium">{item.descripcion}</p><span className="text-xs text-muted-foreground capitalize">{(item.tipo_operacion || "").toLowerCase()}</span></td><td className={`px-4 py-3 text-right font-bold ${item.cantidad_minutos >= 0 ? 'text-green-600' : 'text-red-500'}`}>{item.cantidad_minutos > 0 ? '+' : ''}{formatMinutesToFloat(item.cantidad_minutos)}</td><td className="px-4 py-3 text-right font-medium">{formatMinutesToFloat(item.saldo_nuevo)}</td></tr>))}</tbody></table></div>
                            </div>
                            <div className="p-6 bg-muted/10 flex flex-col gap-6 overflow-y-auto">
                                <div className="bg-background border border-border rounded-lg p-4 shadow-sm space-y-3"><h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Resumen</h4>{balanceData ? (<><div className="flex justify-between items-end pb-2 border-b border-border"><span className="text-sm">Disponible:</span><span className="text-2xl font-bold text-primary">{formatMinutesToFloat(balanceData.saldo_disponible)}</span></div><div className="space-y-1 text-sm"><div className="flex justify-between text-muted-foreground"><span>Total:</span><span>{formatMinutesToFloat(balanceData.saldo_total)}</span></div>{balanceData.saldo_pendiente > 0 && (<div className="flex justify-between text-amber-600 font-medium"><span>Pendiente:</span><span>{formatMinutesToFloat(balanceData.saldo_pendiente)}</span></div>)}</div></>) : "Cargando..."}</div>
                                <div className="bg-background border border-border rounded-lg p-4 shadow-sm space-y-4"><h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Registrar Canjeo</h4><form onSubmit={handleManagerRedemption} className="space-y-3"><div><label className="text-xs font-medium block mb-1">Tipo</label><select value={tipo} onChange={(e) => { setTipo(e.target.value); setFechaSingle(""); setHoraLlegada(""); setHoraSalida(""); setRedemptionForm(p => ({ ...p, minutos: "" })); setCalculatedDisplay("") }} className="w-full px-3 py-2 border border-input rounded-md text-sm"><option value="DIA_COMPLETO">Día Completo</option><option value="LLEGADA_TARDIA">Llegada Tardía</option><option value="SALIDA_TEMPRANA">Salida Temprana</option></select></div>{tipo === 'DIA_COMPLETO' && (<div><label className="text-xs font-medium block mb-1">Fecha</label><input type="date" value={fechaSingle} onChange={e => handleFullDayLogic(e.target.value)} required className="w-full px-3 py-2 border border-input rounded-md text-sm" /></div>)}{tipo === 'LLEGADA_TARDIA' && (<div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-medium block mb-1">Fecha</label><input type="date" value={fechaSingle} onChange={e => handleLateArrivalLogic(e.target.value, horaLlegada)} required className="w-full px-3 py-2 border border-input rounded-md text-sm" /></div><div><label className="text-xs font-medium block mb-1">Hora Llegada</label><input type="time" value={horaLlegada} onChange={e => handleLateArrivalLogic(fechaSingle, e.target.value)} required className="w-full px-3 py-2 border border-input rounded-md text-sm" /></div></div>)}{tipo === 'SALIDA_TEMPRANA' && (<div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-medium block mb-1">Fecha</label><input type="date" value={fechaSingle} onChange={e => handleEarlyDepartureLogic(e.target.value, horaSalida)} required className="w-full px-3 py-2 border border-input rounded-md text-sm" /></div><div><label className="text-xs font-medium block mb-1">Hora Salida</label><input type="time" value={horaSalida} onChange={e => handleEarlyDepartureLogic(fechaSingle, e.target.value)} required className="w-full px-3 py-2 border border-input rounded-md text-sm" /></div></div>)}<div><label className="text-xs font-medium block mb-1">Tiempo (Calculado)</label><input type="text" readOnly value={calculatedDisplay} className="w-full px-3 py-2 border border-input rounded-md text-sm bg-muted text-foreground" /></div><div><label className="text-xs font-medium block mb-1">Motivo</label><textarea rows={2} required value={redemptionForm.motivo} onChange={e => setRedemptionForm(p => ({ ...p, motivo: e.target.value }))} className="w-full px-3 py-2 border border-input rounded-md text-sm resize-none" /></div><button type="submit" disabled={redeeming || !redemptionForm.minutos} className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50">{redeeming ? "..." : "Registrar"}</button></form></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function formatMinutesToFloat(minutes) {
    if (!minutes) return "0h"
    const hours = minutes / 60
    return `${parseFloat(hours.toFixed(2))}h`
}
