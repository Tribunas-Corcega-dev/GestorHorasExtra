import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { calculateTotalMinutes, getIntervals, timeToMinutes, formatMinutesToHHMM } from "@/lib/calculations"

export function BalanceManagementPage({ employeeId }) {
    const router = useRouter()

    const [employee, setEmployee] = useState(null)
    const [balanceData, setBalanceData] = useState(null)
    const [schedule, setSchedule] = useState(null)
    const [loading, setLoading] = useState(true)

    // Form State
    const [redemptionMode, setRedemptionMode] = useState("MANUAL")
    const [tipo, setTipo] = useState("SALIDA_TEMPRANA")
    const [manualDate, setManualDate] = useState("")
    const [manualHoursInput, setManualHoursInput] = useState("")
    const [manualMinutesInput, setManualMinutesInput] = useState("")
    const [manualShiftHalf, setManualShiftHalf] = useState("MANANA")
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
        if (!employeeId) return

        let alive = true

        async function loadPageData() {
            try {
                setLoading(true)

                const [empRes] = await Promise.all([
                    fetch(`/api/empleados/${employeeId}`),
                    fetchBalance(employeeId)
                ])

                if (alive && empRes.ok) {
                    const empData = await empRes.json()
                    setEmployee(empData)
                }
            } catch (error) {
                console.error("Error loading compensation page:", error)
            } finally {
                if (alive) {
                    resetForm()
                    setLoading(false)
                }
            }
        }

        loadPageData()

        return () => {
            alive = false
        }
    }, [employeeId])

    const resetForm = () => {
        setRedemptionMode("MANUAL")
        setTipo("SALIDA_TEMPRANA")
        setManualDate("")
        setManualHoursInput("")
        setManualMinutesInput("")
        setManualShiftHalf("MANANA")
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
    }

    async function fetchBalance(targetEmployeeId) {
        try {
            const res = await fetch(`/api/compensatorios/saldo?userId=${targetEmployeeId}`)
            if (res.ok) {
                const data = await res.json()
                setBalanceData(data)

                if (data.jornada_fija_hhmm) {
                    try {
                        const parsed = typeof data.jornada_fija_hhmm === "string"
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
        const dateObj = new Date(dateStr + "T12:00:00")
        const dayIndex = dateObj.getDay()
        const daysMap = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]
        return schedule[daysMap[dayIndex]]
    }

    const formatMinutesForDisplay = (minutes) => {
        const safeMinutes = Math.max(0, Number(minutes) || 0)
        const decimalHours = parseFloat((safeMinutes / 60).toFixed(2))
        const hoursInt = Math.floor(safeMinutes / 60)
        const minutesInt = safeMinutes % 60
        return `${decimalHours} horas (${hoursInt}h ${minutesInt}m)`
    }

    const updateCalculatedValues = (minutes) => {
        setRedemptionForm((prev) => ({ ...prev, minutos: minutes.toString() }))
        setCalculatedDisplay(formatMinutesForDisplay(minutes))
    }

    const getManualRequestedMinutes = () => {
        const normalizedHours = (manualHoursInput || "").trim()
        const normalizedMinutes = (manualMinutesInput || "").trim()

        if (normalizedHours !== "" && !/^\d+$/.test(normalizedHours)) return null
        if (normalizedMinutes !== "" && !/^\d{1,2}$/.test(normalizedMinutes)) return null

        const hours = normalizedHours === "" ? 0 : Number.parseInt(normalizedHours, 10)
        const minutes = normalizedMinutes === "" ? 0 : Number.parseInt(normalizedMinutes, 10)

        if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
        if (hours < 0 || minutes < 0 || minutes > 59) return null

        const total = hours * 60 + minutes
        return total > 0 ? total : null
    }

    const getFallbackInterval = (shiftHalf) => {
        if (shiftHalf === "MANANA") return { start: "08:00", end: "12:00" }
        return { start: "13:00", end: "17:00" }
    }

    const buildManualRedemptionData = () => {
        if (!manualDate) return { error: "Selecciona una fecha para el canje manual" }

        const requestedMinutes = getManualRequestedMinutes()
        if (!requestedMinutes || Number.isNaN(requestedMinutes) || requestedMinutes <= 0) {
            return { error: "Ingresa horas y minutos validos" }
        }

        const daySchedule = getDaySchedule(manualDate)

        let selectedInterval = null
        if (daySchedule?.enabled) {
            selectedInterval = manualShiftHalf === "MANANA" ? daySchedule.morning : daySchedule.afternoon
            if (!selectedInterval?.enabled) selectedInterval = null
        }

        const interval = selectedInterval || getFallbackInterval(manualShiftHalf)
        const intervalStartMin = timeToMinutes(interval.start)
        const intervalEndMin = timeToMinutes(interval.end)

        if (intervalEndMin <= intervalStartMin) {
            return { error: "No fue posible calcular la franja seleccionada" }
        }

        const midpoint = Math.floor((intervalStartMin + intervalEndMin) / 2)
        const halfWindow = Math.ceil(requestedMinutes / 2)

        let computedStartMin = Math.max(intervalStartMin, midpoint - halfWindow)
        let computedEndMin = computedStartMin + requestedMinutes

        if (computedEndMin > intervalEndMin) {
            computedEndMin = intervalEndMin
            computedStartMin = Math.max(intervalStartMin, computedEndMin - requestedMinutes)
        }

        const effectiveMinutes = computedEndMin - computedStartMin
        if (effectiveMinutes <= 0) {
            return { error: "No fue posible calcular un rango de tiempo valido" }
        }

        return {
            tipo: manualShiftHalf === "MANANA" ? "LLEGADA_TARDIA" : "SALIDA_TEMPRANA",
            fecha_inicio: `${manualDate}T${formatMinutesToHHMM(computedStartMin)}`,
            fecha_fin: `${manualDate}T${formatMinutesToHHMM(computedEndMin)}`,
            minutos: effectiveMinutes
        }
    }

    const getManualDisplay = () => {
        const totalMinutes = getManualRequestedMinutes()
        if (!totalMinutes || Number.isNaN(totalMinutes) || totalMinutes <= 0) return ""
        return formatMinutesForDisplay(totalMinutes)
    }

    const handleFullDayLogic = (dateStr) => {
        setFechaSingle(dateStr)
        if (!dateStr) return

        const daySchedule = getDaySchedule(dateStr)
        if (!daySchedule || !daySchedule.enabled) {
            alert("El empleado no tiene turno programado para este dia.")
            updateCalculatedValues(0)
            return
        }

        const intervals = getIntervals(daySchedule)
        const totalMinutes = calculateTotalMinutes(intervals)
        updateCalculatedValues(totalMinutes)

        let startStr = ""
        let endStr = ""
        if (daySchedule.morning?.enabled) {
            startStr = daySchedule.morning.start
            endStr = daySchedule.morning.end
        }
        if (daySchedule.afternoon?.enabled) {
            if (!startStr) startStr = daySchedule.afternoon.start
            endStr = daySchedule.afternoon.end
        }

        if (startStr && endStr) {
            setRedemptionForm((prev) => ({
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
        setRedemptionForm((prev) => ({
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
        setRedemptionForm((prev) => ({
            ...prev,
            fecha_inicio: `${dateStr}T${timeStr}`,
            fecha_fin: `${dateStr}T${formatMinutesToHHMM(lastEnd)}`
        }))
    }

    async function handleManagerRedemption(e) {
        e.preventDefault()
        if (!redemptionForm.motivo) return alert("Ingresa un motivo")

        let payloadTipo = tipo
        let payloadFechaInicio = redemptionForm.fecha_inicio
        let payloadFechaFin = redemptionForm.fecha_fin
        let payloadMinutos = parseInt(redemptionForm.minutos, 10)

        if (redemptionMode === "MANUAL") {
            const manualPayload = buildManualRedemptionData()
            if (manualPayload.error) return alert(manualPayload.error)

            payloadTipo = manualPayload.tipo
            payloadFechaInicio = manualPayload.fecha_inicio
            payloadFechaFin = manualPayload.fecha_fin
            payloadMinutos = manualPayload.minutos
        }

        if (!payloadMinutos || Number.isNaN(payloadMinutos) || payloadMinutos <= 0) {
            return alert("Cantidad de tiempo invalida")
        }

        try {
            setRedeeming(true)

            const res = await fetch("/api/compensatorios/solicitar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetUserId: employeeId,
                    tipo: payloadTipo,
                    fecha_inicio: payloadFechaInicio,
                    fecha_fin: payloadFechaFin,
                    minutos_solicitados: payloadMinutos,
                    motivo: redemptionMode === "MANUAL"
                        ? `${redemptionForm.motivo} (Canje manual: ${manualShiftHalf === "MANANA" ? "mitad jornada manana" : "mitad jornada tarde"})`
                        : redemptionForm.motivo
                })
            })

            const data = await res.json()

            if (res.ok) {
                alert("Canjeo realizado exitosamente")
                await fetchBalance(employeeId)
                resetForm()
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

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
                <div className="bg-card border border-border rounded-xl p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin"></div>
                        <p className="text-sm font-medium text-muted-foreground animate-pulse">Cargando gestion de compensacion...</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 space-y-3">
                            <div className="h-10 rounded-md bg-muted animate-pulse"></div>
                            <div className="h-12 rounded-md bg-muted/80 animate-pulse"></div>
                            <div className="h-12 rounded-md bg-muted/80 animate-pulse"></div>
                            <div className="h-12 rounded-md bg-muted/80 animate-pulse"></div>
                            <div className="h-12 rounded-md bg-muted/80 animate-pulse"></div>
                        </div>
                        <div className="space-y-3">
                            <div className="h-24 rounded-md bg-muted animate-pulse"></div>
                            <div className="h-10 rounded-md bg-muted/80 animate-pulse"></div>
                            <div className="h-10 rounded-md bg-muted/80 animate-pulse"></div>
                            <div className="h-24 rounded-md bg-muted/80 animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">Gestion de Compensacion en Tiempo</h1>
                    <p className="text-sm text-muted-foreground">
                        Empleado: <span className="font-medium text-foreground">{employee?.nombre || employee?.username || "-"}</span>
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-4 py-2 border border-input rounded-md text-sm hover:bg-accent transition-colors"
                >
                    Volver
                </button>
            </div>

            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
                <div className="md:col-span-2 flex flex-col overflow-hidden min-h-[60vh]">
                    <div className="p-4 bg-muted/20 border-b border-border">
                        <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Historial de Movimientos</h4>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0">
                        <table className="w-full text-sm">
                            <thead className="bg-muted text-muted-foreground sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium">Fecha</th>
                                    <th className="px-4 py-2 text-left font-medium">Concepto</th>
                                    <th className="px-4 py-2 text-right font-medium">Operacion</th>
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
                                                <td className={`px-4 py-3 text-right font-bold ${item.cantidad_minutos >= 0 ? "text-green-600" : "text-red-500"}`}>
                                                    {item.cantidad_minutos > 0 ? "+" : ""}{formatMinutesToFloat(item.cantidad_minutos)}
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

                <div className="p-6 bg-muted/10 flex flex-col gap-6 overflow-y-auto">
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

                    <div className="bg-background border border-border rounded-lg p-4 shadow-sm space-y-4">
                        <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Registrar Canjeo</h4>
                        <p className="text-xs text-muted-foreground">Manual es la vista principal. La automatica queda como secundaria.</p>

                        <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-1 bg-muted/30">
                            <button
                                type="button"
                                onClick={() => {
                                    setRedemptionMode("MANUAL")
                                    setCalculatedDisplay("")
                                }}
                                className={`px-3 py-2 text-xs rounded transition-colors ${redemptionMode === "MANUAL" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                            >
                                Manual (Principal)
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setRedemptionMode("AUTOMATICO")
                                    setCalculatedDisplay("")
                                }}
                                className={`px-3 py-2 text-xs rounded transition-colors ${redemptionMode === "AUTOMATICO" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                            >
                                Automatico (Secundario)
                            </button>
                        </div>

                        <form onSubmit={handleManagerRedemption} className="space-y-3">
                            {redemptionMode === "MANUAL" ? (
                                <>
                                    <div>
                                        <label className="text-xs font-medium block mb-1">Fecha</label>
                                        <input
                                            type="date"
                                            value={manualDate}
                                            onChange={(e) => setManualDate(e.target.value)}
                                            required
                                            className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium block mb-1">Cantidad a Reclamar</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min="0"
                                                step="1"
                                                value={manualHoursInput}
                                                onChange={(e) => setManualHoursInput(e.target.value)}
                                                placeholder="Horas"
                                                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                            />
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min="0"
                                                max="59"
                                                step="1"
                                                value={manualMinutesInput}
                                                onChange={(e) => setManualMinutesInput(e.target.value)}
                                                placeholder="Minutos"
                                                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium block mb-1">Mitad de Jornada</label>
                                        <select
                                            value={manualShiftHalf}
                                            onChange={(e) => setManualShiftHalf(e.target.value)}
                                            className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                        >
                                            <option value="MANANA">Mitad de la mañana</option>
                                            <option value="TARDE">Mitad de la tarde</option>
                                        </select>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-xs font-medium block mb-1">Tipo de Canjeo</label>
                                        <select
                                            value={tipo}
                                            onChange={(e) => {
                                                setTipo(e.target.value)
                                                setFechaSingle("")
                                                setHoraLlegada("")
                                                setHoraSalida("")
                                                setRedemptionForm((prev) => ({ ...prev, minutos: "" }))
                                                setCalculatedDisplay("")
                                            }}
                                            className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                        >
                                            <option value="DIA_COMPLETO">Dia Completo</option>
                                            <option value="LLEGADA_TARDIA">Llegada Tarde</option>
                                            <option value="SALIDA_TEMPRANA">Salida Temprana</option>
                                        </select>
                                    </div>

                                    {tipo === "DIA_COMPLETO" && (
                                        <div>
                                            <label className="text-xs font-medium block mb-1">Fecha</label>
                                            <input
                                                type="date"
                                                value={fechaSingle}
                                                onChange={(e) => handleFullDayLogic(e.target.value)}
                                                required
                                                className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                            />
                                        </div>
                                    )}

                                    {tipo === "LLEGADA_TARDIA" && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs font-medium block mb-1">Fecha</label>
                                                <input
                                                    type="date"
                                                    value={fechaSingle}
                                                    onChange={(e) => handleLateArrivalLogic(e.target.value, horaLlegada)}
                                                    required
                                                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium block mb-1">Hora Llegada</label>
                                                <input
                                                    type="time"
                                                    value={horaLlegada}
                                                    onChange={(e) => handleLateArrivalLogic(fechaSingle, e.target.value)}
                                                    required
                                                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {tipo === "SALIDA_TEMPRANA" && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs font-medium block mb-1">Fecha</label>
                                                <input
                                                    type="date"
                                                    value={fechaSingle}
                                                    onChange={(e) => handleEarlyDepartureLogic(e.target.value, horaSalida)}
                                                    required
                                                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium block mb-1">Hora Salida</label>
                                                <input
                                                    type="time"
                                                    value={horaSalida}
                                                    onChange={(e) => handleEarlyDepartureLogic(fechaSingle, e.target.value)}
                                                    required
                                                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            <div>
                                <label className="text-xs font-medium block mb-1">Tiempo a descontar</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={redemptionMode === "MANUAL" ? getManualDisplay() : calculatedDisplay}
                                    placeholder={redemptionMode === "MANUAL" ? "Definido manualmente" : "Calculado automaticamente"}
                                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-muted text-foreground"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium block mb-1">Motivo</label>
                                <textarea
                                    rows={2}
                                    required
                                    placeholder="Ej: Permiso personal, Cita medica..."
                                    value={redemptionForm.motivo}
                                    onChange={(e) => setRedemptionForm((prev) => ({ ...prev, motivo: e.target.value }))}
                                    className="w-full px-3 py-2 border border-input rounded-md text-sm bg-background resize-none"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={redeeming || (redemptionMode === "MANUAL" ? !manualDate || !getManualRequestedMinutes() : !redemptionForm.minutos)}
                                className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {redeeming ? "Procesando..." : "Registrar y Descontar"}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}

function formatMinutesToFloat(minutes) {
    if (!minutes) return "0h"
    const hours = minutes / 60
    return `${parseFloat(hours.toFixed(2))}h`
}









