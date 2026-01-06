"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"

function formatMinutesToTime(minutes) {
    if (!minutes) return "0h 0m"
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h ${m}m`
}

// Import helper
import { calculateTotalMinutes, getIntervals, timeToMinutes, formatMinutesToHHMM } from "@/lib/calculations"

export function CompensatoryTimeWidget() {
    const { user } = useAuth()
    const [balance, setBalance] = useState(0) // Now represents AVAILABLE balance
    const [balanceTotal, setBalanceTotal] = useState(0)
    const [balancePending, setBalancePending] = useState(0)
    const [history, setHistory] = useState([])
    const [schedule, setSchedule] = useState(null)
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)

    // Form state
    const [tipo, setTipo] = useState("DIA_COMPLETO")
    const [fechaSingle, setFechaSingle] = useState("") // For 'DIA_COMPLETO', 'LLEGADA_TARDIA', 'SALIDA_TEMPRANA'
    const [horaLlegada, setHoraLlegada] = useState("") // For 'LLEGADA_TARDIA'
    const [horaSalida, setHoraSalida] = useState("") // For 'SALIDA_TEMPRANA'
    const [fechaInicio, setFechaInicio] = useState("")
    const [fechaFin, setFechaFin] = useState("")
    const [minutosSolicitados, setMinutosSolicitados] = useState("")
    const [motivo, setMotivo] = useState("")
    const [submitting, setSubmitting] = useState(false)

    // Derived state for display
    const [calculatedDisplay, setCalculatedDisplay] = useState("")

    // Calculate min date (Tomorrow) for UI restriction
    const getTomorrowDate = () => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${dd}`
    }
    const minDate = getTomorrowDate()

    useEffect(() => {
        if (user) {
            fetchBalance()
        }
    }, [user])

    async function fetchBalance() {
        try {
            const res = await fetch("/api/compensatorios/saldo")
            if (res.ok) {
                const data = await res.json()
                setBalance(data.saldo_disponible || 0)
                setBalanceTotal(data.saldo_total || 0)
                setBalancePending(data.saldo_pendiente || 0)
                setHistory(data.historial || [])

                // Parse schedule
                if (data.jornada_fija_hhmm) {
                    try {
                        const parsed = typeof data.jornada_fija_hhmm === 'string'
                            ? JSON.parse(data.jornada_fija_hhmm)
                            : data.jornada_fija_hhmm
                        setSchedule(parsed)
                    } catch (e) {
                        console.error("Error parsing schedule:", e)
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching balance:", error)
        } finally {
            setLoading(false)
        }
    }

    // Helper to get day schedule
    const getDaySchedule = (dateStr) => {
        if (!dateStr || !schedule) return null
        const dateObj = new Date(dateStr + 'T12:00:00')
        const dayIndex = dateObj.getDay()
        const daysMap = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
        return schedule[daysMap[dayIndex]]
    }

    // Logic for "DIA_COMPLETO"
    const handleFullDayLogic = (dateStr) => {
        setFechaSingle(dateStr)
        if (!dateStr) return

        // Validate future date
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const selectedDate = new Date(dateStr + 'T00:00:00')

        if (selectedDate <= today) {
            alert("La fecha debe ser posterior al día actual.")
            setMinutosSolicitados("")
            setCalculatedDisplay("")
            return
        }

        const daySchedule = getDaySchedule(dateStr)

        if (!daySchedule || !daySchedule.enabled) {
            alert("No tienes turno programado para este día.")
            setMinutosSolicitados("")
            setCalculatedDisplay("")
            return
        }

        const intervals = getIntervals(daySchedule)
        const totalMinutes = calculateTotalMinutes(intervals)

        updateCalculatedValues(totalMinutes)

        // Set timestamps
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
            setFechaInicio(`${dateStr}T${startStr}`)
            setFechaFin(`${dateStr}T${endStr}`)
        }
    }

    // Logic for "LLEGADA_TARDIA"
    const handleLateArrivalLogic = (dateStr, timeStr) => {
        setFechaSingle(dateStr)
        setHoraLlegada(timeStr)

        if (!dateStr || !timeStr) return

        // Validate future date
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const selectedDate = new Date(dateStr + 'T00:00:00')

        if (selectedDate <= today) {
            alert("La fecha debe ser posterior al día actual.")
            setMinutosSolicitados("")
            setCalculatedDisplay("")
            return
        }

        const daySchedule = getDaySchedule(dateStr)
        if (!daySchedule || !daySchedule.enabled) {
            return
        }

        const startTime = daySchedule.morning?.start || daySchedule.afternoon?.start
        if (!startTime) return

        const startMin = timeToMinutes(startTime)
        const arrivalMin = timeToMinutes(timeStr)

        // Validate Arrival Time is within working hours
        // Must be within [Start, End] of Morning OR [Start, End] of Afternoon
        let isValidTime = false
        const intervals = getIntervals(daySchedule)

        for (const interval of intervals) {
            if (arrivalMin >= interval.start && arrivalMin <= interval.end) {
                isValidTime = true
                break
            }
        }

        if (!isValidTime) {
            // Check if it's explicitly before the first shift (already handled conceptually by logic but good to feedback)
            // or in the break.
            // Actually, if I arrive BEFORE the start, it's just "early", but user says "no puede encontrarse fuera...antes".
            // So strict check matches intervals.
            setMinutosSolicitados("")
            setCalculatedDisplay("La hora debe estar dentro de la jornada laboral.")
            return
        }

        // Calculate minutes based on start time
        // Note: If I arrive in the afternoon, do I deduct morning + part of afternoon?
        // Yes. "Llegada Tardía" implies I missed everything before.
        // So Diff = Arrival - FirstStart - (Break if applicable?)
        // Wait, simply: Time missed = Total Working Minutes *scheduled BEFORE arrival*.
        // Correct logic:
        // Calculate overlapping working minutes between [FirstStart, Arrival].
        // Simple diff (ArrivalDiff = Arrival - FirstStart) includes break time! We must exclude break.
        if (intervals.length === 0) {
            setCalculatedDisplay("No hay horas laborales definidas.")
            return
        }

        const firstStart = intervals[0].start

        let missedMinutes = 0
        for (const interval of intervals) {
            // Intersection of (interval) and (firstStart -> arrival)
            const overlapStart = Math.max(interval.start, firstStart)
            const overlapEnd = Math.min(interval.end, arrivalMin)

            if (overlapStart < overlapEnd) {
                missedMinutes += (overlapEnd - overlapStart)
            }
        }

        updateCalculatedValues(missedMinutes)

        setFechaInicio(`${dateStr}T${startTime}`)
        setFechaFin(`${dateStr}T${timeStr}`)
    }

    // Logic for "SALIDA_TEMPRANA"
    const handleEarlyDepartureLogic = (dateStr, timeStr) => {
        setFechaSingle(dateStr)
        setHoraSalida(timeStr)

        if (!dateStr || !timeStr) return

        // Validate future date
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const selectedDate = new Date(dateStr + 'T00:00:00')

        if (selectedDate <= today) {
            alert("La fecha debe ser posterior al día actual.")
            setMinutosSolicitados("")
            setCalculatedDisplay("")
            return
        }

        const daySchedule = getDaySchedule(dateStr)
        if (!daySchedule || !daySchedule.enabled) {
            return
        }

        const intervals = getIntervals(daySchedule)
        if (intervals.length === 0) {
            setCalculatedDisplay("No hay horas laborales definidas.")
            return
        }

        const lastEnd = intervals[intervals.length - 1].end
        const exitMin = timeToMinutes(timeStr)

        // Validate Exit Time is within working hours
        let isValidTime = false
        for (const interval of intervals) {
            if (exitMin >= interval.start && exitMin <= interval.end) {
                isValidTime = true
                break
            }
        }

        if (!isValidTime) {
            setMinutosSolicitados("")
            setCalculatedDisplay("La hora debe estar dentro de la jornada laboral.")
            return
        }

        // Calculate overlap from ExitTime to EndOfDay
        let missedMinutes = 0
        for (const interval of intervals) {
            const overlapStart = Math.max(interval.start, exitMin)
            const overlapEnd = Math.min(interval.end, lastEnd)

            if (overlapStart < overlapEnd) {
                missedMinutes += (overlapEnd - overlapStart)
            }
        }

        updateCalculatedValues(missedMinutes)

        setFechaInicio(`${dateStr}T${timeStr}`)
        setFechaFin(`${dateStr}T${formatMinutesToHHMM(lastEnd)}`)
    }

    const updateCalculatedValues = (minutes) => {
        setMinutosSolicitados(minutes.toString())
        const hoursDecimal = (minutes / 60).toFixed(2)
        const hoursInt = Math.floor(minutes / 60)
        const minutesInt = minutes % 60
        setCalculatedDisplay(`${hoursDecimal}h (${hoursInt}h ${minutesInt}m)`)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setSubmitting(true)

        try {
            // Basic validation
            if (!minutosSolicitados || parseInt(minutosSolicitados) <= 0) {
                alert("Por favor ingrese una cantidad de tiempo válida")
                setSubmitting(false)
                return
            }

            if (parseInt(minutosSolicitados) > balance) {
                alert("No tienes suficiente saldo disponible")
                setSubmitting(false)
                return
            }

            const res = await fetch("/api/compensatorios/solicitar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tipo,
                    fecha_inicio: fechaInicio,
                    fecha_fin: fechaFin || fechaInicio,
                    minutos_solicitados: parseInt(minutosSolicitados),
                    motivo
                })
            })

            const data = await res.json()
            if (res.ok) {
                alert("Solicitud creada exitosamente")
                setShowModal(false)
                // Reset form
                setTipo("DIA_COMPLETO")
                setFechaSingle("")
                setHoraLlegada("")
                setHoraSalida("")
                setFechaInicio("")
                setFechaFin("")
                setMinutosSolicitados("")
                setMotivo("")
                setCalculatedDisplay("")
                window.location.reload()
            } else {
                alert("Error: " + data.message)
            }
        } catch (err) {
            console.error(err)
            alert("Error al crear solicitud")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return <div className="animate-pulse h-32 bg-card rounded-lg border border-border"></div>

    const canFullDay = balance >= 465 // 7.75 hours

    return (
        <div className="bg-card border border-border rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-bold text-foreground">Bolsa de Horas</h3>
                    <p className="text-sm text-muted-foreground">Tiempo compensatorio disponible</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-full font-medium transition-colors"
                >
                    Usar Tiempo
                </button>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-2 text-center border-b border-border pb-4">
                <div>
                    <span className="block text-2xl font-bold text-foreground">{formatMinutesToTime(balanceTotal)}</span>
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold">Total</span>
                </div>
                <div>
                    <span className="block text-2xl font-bold text-orange-500">{formatMinutesToTime(balancePending)}</span>
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold">En Solicitud</span>
                </div>
                <div>
                    <span className="block text-2xl font-bold text-green-600">{formatMinutesToTime(balance)}</span>
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold">Disponible</span>
                </div>
            </div>

            {/* Mini History */}
            <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Movimientos Recientes</h4>
                {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No hay movimientos registrados</p>
                ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                        {history.slice(0, 5).map(item => (
                            <div key={item.id} className="flex justify-between items-center text-sm border-b border-border/50 pb-1 last:border-0">
                                <div>
                                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${item.tipo_movimiento === 'ACUMULACION' ? 'bg-green-500' :
                                        item.tipo_movimiento === 'USO' ? 'bg-orange-500' : 'bg-blue-500'
                                        }`}></span>
                                    <span className="font-medium text-foreground">
                                        {item.tipo_movimiento === 'ACUMULACION' ? 'Acumulación' :
                                            item.tipo_movimiento === 'USO' ? 'Uso' : 'Ajuste'}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className={item.tipo_movimiento === 'USO' ? 'text-destructive' : 'text-green-600'}>
                                        {item.tipo_movimiento === 'USO' ? '-' : '+'}{formatMinutesToTime(item.minutos)}
                                    </span>
                                    <p className="text-[10px] text-muted-foreground">
                                        {new Date(item.fecha).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Request Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold text-foreground mb-4">Solicitar Tiempo Libre</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Tipo de Solicitud</label>
                                <select
                                    value={tipo}
                                    onChange={(e) => {
                                        setTipo(e.target.value)
                                        // Reset fields when switching
                                        setFechaSingle("")
                                        setHoraLlegada("")
                                        setHoraSalida("")
                                        setFechaInicio("")
                                        setFechaFin("")
                                        setMinutosSolicitados("")
                                        setCalculatedDisplay("")
                                    }}
                                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="DIA_COMPLETO" disabled={!canFullDay}>
                                        {canFullDay ? "Día Completo" : "Día Completo (Saldo insuficiente)"}
                                    </option>
                                    <option value="LLEGADA_TARDIA">Llegada Tardía</option>
                                    <option value="SALIDA_TEMPRANA">Salida Temprana</option>
                                </select>
                            </div>

                            {tipo === 'DIA_COMPLETO' && (
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Fecha</label>
                                    <input
                                        type="date"
                                        min={minDate}
                                        value={fechaSingle}
                                        onChange={(e) => handleFullDayLogic(e.target.value)}
                                        required
                                        className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Se descontarán horas según tu horario fijo.
                                    </p>
                                </div>
                            )}

                            {tipo === 'LLEGADA_TARDIA' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Fecha</label>
                                        <input
                                            type="date"
                                            min={minDate}
                                            value={fechaSingle}
                                            onChange={(e) => handleLateArrivalLogic(e.target.value, horaLlegada)}
                                            required
                                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Hora de Llegada</label>
                                        <input
                                            type="time"
                                            value={horaLlegada}
                                            onChange={(e) => handleLateArrivalLogic(fechaSingle, e.target.value)}
                                            required
                                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                                        />
                                    </div>
                                </div>
                            )}

                            {tipo === 'SALIDA_TEMPRANA' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Fecha</label>
                                        <input
                                            type="date"
                                            min={minDate}
                                            value={fechaSingle}
                                            onChange={(e) => handleEarlyDepartureLogic(e.target.value, horaSalida)}
                                            required
                                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Hora de Salida</label>
                                        <input
                                            type="time"
                                            value={horaSalida}
                                            onChange={(e) => handleEarlyDepartureLogic(fechaSingle, e.target.value)}
                                            required
                                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                                        />
                                    </div>
                                </div>
                            )}

                            {tipo !== 'DIA_COMPLETO' && tipo !== 'LLEGADA_TARDIA' && tipo !== 'SALIDA_TEMPRANA' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Desde</label>
                                        <input
                                            type="datetime-local"
                                            value={fechaInicio}
                                            onChange={(e) => setFechaInicio(e.target.value)}
                                            required
                                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Hasta</label>
                                        <input
                                            type="datetime-local"
                                            value={fechaFin}
                                            onChange={(e) => setFechaFin(e.target.value)}
                                            required
                                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Tiempo a descontar</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={(tipo === 'DIA_COMPLETO' || tipo === 'LLEGADA_TARDIA' || tipo === 'SALIDA_TEMPRANA') ? calculatedDisplay : minutesToDisplay(minutosSolicitados)}
                                        readOnly={tipo === 'DIA_COMPLETO' || tipo === 'LLEGADA_TARDIA' || tipo === 'SALIDA_TEMPRANA'}
                                        onChange={(e) => {
                                            if (tipo !== 'DIA_COMPLETO' && tipo !== 'LLEGADA_TARDIA' && tipo !== 'SALIDA_TEMPRANA') setMinutosSolicitados(e.target.value)
                                        }}
                                        className={`w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${(tipo === 'DIA_COMPLETO' || tipo === 'LLEGADA_TARDIA' || tipo === 'SALIDA_TEMPRANA') ? 'bg-muted' : 'bg-background text-foreground'} ${(calculatedDisplay.includes('debe') || calculatedDisplay.includes('posterior')) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
                                        placeholder={(tipo === 'DIA_COMPLETO' || tipo === 'LLEGADA_TARDIA' || tipo === 'SALIDA_TEMPRANA') ? "Selecciona fecha/hora" : "Minutos (ej. 120)"}
                                    />
                                    {tipo !== 'DIA_COMPLETO' && tipo !== 'LLEGADA_TARDIA' && tipo !== 'SALIDA_TEMPRANA' && (
                                        <input
                                            type="number"
                                            className="absolute inset-0 opacity-0 cursor-text"
                                            value={minutosSolicitados}
                                            onChange={(e) => setMinutosSolicitados(e.target.value)}
                                        />
                                    )}
                                </div>
                                {tipo !== 'DIA_COMPLETO' && (
                                    <p className="text-xs text-muted-foreground mt-1 text-right">
                                        Disponible: {balance} min
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Motivo</label>
                                <textarea
                                    value={motivo}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    rows="3"
                                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                    placeholder="Detalle el motivo..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-border mt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || (tipo === 'DIA_COMPLETO' && !minutosSolicitados) || (tipo === 'LLEGADA_TARDIA' && !minutosSolicitados) || (tipo === 'SALIDA_TEMPRANA' && !minutosSolicitados)}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    {submitting ? "Enviando..." : "Enviar Solicitud"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

// Helper for generic minutes input
function minutesToDisplay(min) {
    if (!min) return ""
    return min
}
