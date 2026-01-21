import { useState, useEffect } from "react"
import { calculateTotalMinutes, getIntervals, timeToMinutes, formatMinutesToHHMM } from "@/lib/calculations"

export function BalanceManagementModal({ isOpen, onClose, employee, onUpdate }) {
    const [balanceData, setBalanceData] = useState(null)
    const [schedule, setSchedule] = useState(null)
    const [loading, setLoading] = useState(false)

    // Form State
    const [tipo, setTipo] = useState("DIA_COMPLETO")
    const [fechaSingle, setFechaSingle] = useState("")
    const [horaLlegada, setHoraLlegada] = useState("")
    const [horaSalida, setHoraSalida] = useState("")

    const [redemptionForm, setRedemptionForm] = useState({
        fecha_inicio: "",
        fecha_fin: "",
        minutos: "",
        motivo: ""
    })
    const [calculatedDisplay, setCalculatedDisplay] = useState("")
    const [redeeming, setRedeeming] = useState(false)

    useEffect(() => {
        if (isOpen && employee) {
            setupModal()
        }
    }, [isOpen, employee])

    const setupModal = async () => {
        setBalanceData(null)
        setSchedule(null)
        setLoading(true)

        // Reset Form
        setTipo("DIA_COMPLETO")
        setFechaSingle("")
        setHoraLlegada("")
        setHoraSalida("")
        setRedemptionForm({
            fecha_inicio: "",
            fecha_fin: "",
            minutos: "",
            motivo: ""
        })
        setCalculatedDisplay("")

        await fetchBalance(employee.id)
        setLoading(false)
    }

    async function fetchBalance(employeeId) {
        try {
            const res = await fetch(`/api/compensatorios/saldo?userId=${employeeId}`)
            if (res.ok) {
                const data = await res.json()
                setBalanceData(data)

                // Parse schedule if available
                if (data.jornada_fija_hhmm) {
                    try {
                        const parsed = typeof data.jornada_fija_hhmm === 'string'
                            ? JSON.parse(data.jornada_fija_hhmm)
                            : data.jornada_fija_hhmm
                        setSchedule(parsed)
                    } catch (e) {
                        console.error("Error parsing schedule:", e)
                        setSchedule(null)
                    }
                } else {
                    setSchedule(null)
                }
            }
        } catch (error) {
            console.error("Error fetching balance:", error)
        }
    }

    const getDaySchedule = (dateStr) => {
        if (!dateStr || !schedule) return null
        const dateObj = new Date(dateStr + 'T12:00:00')
        // Fix: dateObj.getDay() returns 0 for Sunday
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
            setRedemptionForm(prev => ({
                ...prev,
                fecha_inicio: `${dateStr}T${startStr}`,
                fecha_fin: `${dateStr}T${endStr}`
            }))
        }
    }

    const handleLateArrivalLogic = (dateStr, timeStr) => {
        setFechaSingle(dateStr)
        setHoraLlegada(timeStr)
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
            if (overlapStart < overlapEnd) {
                missedMinutes += (overlapEnd - overlapStart)
            }
        }

        updateCalculatedValues(missedMinutes)
        setRedemptionForm(prev => ({
            ...prev,
            fecha_inicio: `${dateStr}T${startTime}`,
            fecha_fin: `${dateStr}T${timeStr}`
        }))
    }

    const handleEarlyDepartureLogic = (dateStr, timeStr) => {
        setFechaSingle(dateStr)
        setHoraSalida(timeStr)
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
            if (overlapStart < overlapEnd) {
                missedMinutes += (overlapEnd - overlapStart)
            }
        }

        updateCalculatedValues(missedMinutes)
        setRedemptionForm(prev => ({
            ...prev,
            fecha_inicio: `${dateStr}T${timeStr}`,
            fecha_fin: `${dateStr}T${formatMinutesToHHMM(lastEnd)}`
        }))
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
                    targetUserId: employee.id,
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
                // Refresh balance
                await fetchBalance(employee.id)
                if (onUpdate) onUpdate()

                // Reset form
                setTipo("DIA_COMPLETO")
                setFechaSingle("")
                setHoraLlegada("")
                setHoraSalida("")
                setRedemptionForm({
                    fecha_inicio: "",
                    fecha_fin: "",
                    minutos: "",
                    motivo: ""
                })
                setCalculatedDisplay("")
            } else {
                alert("Error: " + data.message)
            }
        } catch (error) {
            console.error("Error redeeming:", error)
            alert("Error al procesar el canjeo")
        } finally {
            setRedeeming(false)
        }
    }

    if (!isOpen || !employee) return null

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card border border-border rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-border flex justify-between items-center bg-blue-50 dark:bg-blue-950/20">
                    <div>
                        <h3 className="text-xl font-bold text-foreground">Gestión de Bolsa de Horas</h3>
                        <p className="text-sm text-muted-foreground">
                            Empleado: <span className="font-medium text-foreground">{employee.nombre || employee.username}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center p-12">
                        <p className="text-muted-foreground">Cargando datos del empleado...</p>
                    </div>
                ) : (
                    /* Content */
                    <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">

                        {/* History Column */}
                        <div className="md:col-span-2 flex flex-col overflow-hidden">
                            <div className="p-4 bg-muted/20 border-b border-border">
                                <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Historial de Movimientos</h4>
                            </div>
                            <div className="flex-1 overflow-y-auto p-0">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted text-muted-foreground sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium">Fecha</th>
                                            <th className="px-4 py-2 text-left font-medium">Concepto</th>
                                            <th className="px-4 py-2 text-right font-medium">Operación</th>
                                            <th className="px-4 py-2 text-right font-medium">Saldo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {balanceData ? (
                                            balanceData.historial && balanceData.historial.length > 0 ? (
                                                balanceData.historial.map((item) => (
                                                    <tr key={item.id} className="hover:bg-accent/50">
                                                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                                            {new Date(item.fecha).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium text-foreground">{item.descripcion}</p>
                                                            <span className="text-xs text-muted-foreground capitalize">{(item.tipo_operacion || "Desconocido").toLowerCase()}</span>
                                                        </td>
                                                        <td className={`px-4 py-3 text-right font-bold ${item.cantidad_minutos >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                            {item.cantidad_minutos > 0 ? '+' : ''}{formatMinutesToFloat(item.cantidad_minutos)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium text-foreground">
                                                            {formatMinutesToFloat(item.saldo_nuevo)}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">
                                                        No hay movimientos registrados
                                                    </td>
                                                </tr>
                                            )
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">
                                                    Cargando datos...
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Actions Column */}
                        <div className="p-6 bg-muted/10 flex flex-col gap-6 overflow-y-auto">
                            {/* Summary Card */}
                            <div className="bg-background border border-border rounded-lg p-4 shadow-sm space-y-3">
                                <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Resumen Actual</h4>
                                {balanceData ? (
                                    <>
                                        <div className="flex justify-between items-end pb-2 border-b border-border">
                                            <span className="text-sm">Disponible:</span>
                                            <span className="text-2xl font-bold text-primary">{formatMinutesToFloat(balanceData.saldo_disponible)}</span>
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <div className="flex justify-between text-muted-foreground">
                                                <span>Acumulado Total:</span>
                                                <span>{formatMinutesToFloat(balanceData.saldo_total)}</span>
                                            </div>
                                            {balanceData.saldo_pendiente > 0 && (
                                                <div className="flex justify-between text-amber-600 font-medium">
                                                    <span>Pendiente Aprobar:</span>
                                                    <span>{formatMinutesToFloat(balanceData.saldo_pendiente)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-sm text-muted-foreground">Cargando saldo...</div>
                                )}
                            </div>

                            {/* Redemption Form */}
                            <div className="bg-background border border-border rounded-lg p-4 shadow-sm space-y-4">
                                <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Registrar Canjeo
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                    Registra un disfrute de horas compensatorias.
                                </p>

                                <form onSubmit={handleManagerRedemption} className="space-y-3">
                                    <div>
                                        <label className="text-xs font-medium block mb-1">Tipo de Canjeo</label>
                                        <select
                                            value={tipo}
                                            onChange={(e) => {
                                                setTipo(e.target.value)
                                                setFechaSingle("")
                                                setHoraLlegada("")
                                                setHoraSalida("")
                                                setRedemptionForm(prev => ({ ...prev, minutos: "" }))
                                                setCalculatedDisplay("")
                                            }}
                                            className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                        >
                                            <option value="DIA_COMPLETO">Día Completo</option>
                                            <option value="LLEGADA_TARDIA">Llegada Tardía</option>
                                            <option value="SALIDA_TEMPRANA">Salida Temprana</option>
                                        </select>
                                    </div>

                                    {tipo === 'DIA_COMPLETO' && (
                                        <div>
                                            <label className="text-xs font-medium block mb-1">Fecha</label>
                                            <input
                                                type="date"
                                                value={fechaSingle}
                                                onChange={e => handleFullDayLogic(e.target.value)}
                                                required
                                                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                            />
                                        </div>
                                    )}

                                    {tipo === 'LLEGADA_TARDIA' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs font-medium block mb-1">Fecha</label>
                                                <input
                                                    type="date"
                                                    value={fechaSingle}
                                                    onChange={e => handleLateArrivalLogic(e.target.value, horaLlegada)}
                                                    required
                                                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium block mb-1">Hora Llegada</label>
                                                <input
                                                    type="time"
                                                    value={horaLlegada}
                                                    onChange={e => handleLateArrivalLogic(fechaSingle, e.target.value)}
                                                    required
                                                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {tipo === 'SALIDA_TEMPRANA' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs font-medium block mb-1">Fecha</label>
                                                <input
                                                    type="date"
                                                    value={fechaSingle}
                                                    onChange={e => handleEarlyDepartureLogic(e.target.value, horaSalida)}
                                                    required
                                                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium block mb-1">Hora Salida</label>
                                                <input
                                                    type="time"
                                                    value={horaSalida}
                                                    onChange={e => handleEarlyDepartureLogic(fechaSingle, e.target.value)}
                                                    required
                                                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-xs font-medium block mb-1">Tiempo a descontar</label>
                                        <input
                                            type="text"
                                            readOnly
                                            value={calculatedDisplay}
                                            placeholder="Calculado automáticamente"
                                            className="w-full px-3 py-2 border border-input rounded-md text-sm bg-muted text-foreground"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium block mb-1">Motivo</label>
                                        <textarea
                                            rows={2}
                                            required
                                            placeholder="Ej: Permiso personal, Cita médica..."
                                            value={redemptionForm.motivo}
                                            onChange={e => setRedemptionForm(prev => ({ ...prev, motivo: e.target.value }))}
                                            className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background resize-none"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={redeeming || !redemptionForm.minutos}
                                        className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center gap-2"
                                    >
                                        {redeeming ? "Procesando..." : "Registrar y Descontar"}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function formatMinutesToFloat(minutes) {
    if (!minutes) return "0h"
    const hours = minutes / 60
    return `${parseFloat(hours.toFixed(2))}h`
}
