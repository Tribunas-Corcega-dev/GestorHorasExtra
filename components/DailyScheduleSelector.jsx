"use client"

import { useState, useEffect } from "react"

const DEFAULT_SCHEDULE = {
    enabled: true,
    es_festivo: false,
    morning: { start: "07:30", end: "12:00", enabled: true },
    afternoon: { start: "13:45", end: "17:00", enabled: true },
}

export function DailyScheduleSelector({ value, onChange, date }) {
    const [schedule, setSchedule] = useState(() => {
        if (value) {
            try {
                // If value is a string, parse it. If it's an object, use it.
                // If it's empty/null, use default.
                const parsed = typeof value === "string" ? JSON.parse(value) : value

                // Merge with defaults to ensure all fields exist (especially new ones like es_festivo)
                return {
                    ...DEFAULT_SCHEDULE,
                    ...parsed,
                    // Explicitly ensure es_festivo is a boolean if it's missing or null
                    es_festivo: parsed?.es_festivo ?? false
                }
            } catch (e) {
                console.error("Error parsing daily schedule value:", e)
                return { ...DEFAULT_SCHEDULE }
            }
        }
        return { ...DEFAULT_SCHEDULE }
    })

    useEffect(() => {
        if (date) {
            const dayOfWeek = getDayOfWeek(date)
            // Auto-set es_festivo if it's Sunday (Domingo)
            const isSunday = dayOfWeek === "Domingo"

            setSchedule(prev => ({
                ...prev,
                dayOfWeek,
                es_festivo: isSunday ? true : prev.es_festivo
            }))
        }
    }, [date])

    useEffect(() => {
        onChange(schedule)
    }, [schedule])

    function getDayOfWeek(dateString) {
        if (!dateString) return ""
        // Create date object and adjust for timezone offset to get correct local day
        const date = new Date(dateString)
        const day = date.getUTCDay()

        const days = [
            "Domingo",
            "Lunes",
            "Martes",
            "Miércoles",
            "Jueves",
            "Viernes",
            "Sábado"
        ]

        return days[day]
    }

    const handleShiftToggle = (period) => {
        setSchedule((prev) => ({
            ...prev,
            [period]: {
                ...prev[period],
                enabled: !prev[period].enabled,
            },
        }))
    }

    const handleTimeChange = (period, field, time) => {
        setSchedule((prev) => ({
            ...prev,
            [period]: {
                ...prev[period],
                [field]: time,
            },
        }))
    }

    const handleFestivoChange = (e) => {
        const isSunday = schedule.dayOfWeek === "Domingo"
        // Prevent unchecking if it's Sunday
        if (isSunday && !e.target.checked) return

        setSchedule(prev => ({
            ...prev,
            es_festivo: e.target.checked
        }))
    }

    return (
        <div className="p-4 border rounded-lg bg-card border-border">
            <div className="flex items-center justify-end mb-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={schedule.es_festivo}
                        onChange={handleFestivoChange}
                        disabled={schedule.dayOfWeek === "Domingo"}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                    />
                    <span className="text-sm font-medium text-foreground">Es Festivo</span>
                </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Morning Shift */}
                <div className={`space-y-2 p-3 rounded-md border ${schedule.morning.enabled ? "border-border/50 bg-background/50" : "border-transparent bg-muted/20 opacity-70"
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mañana</span>
                        <input
                            type="checkbox"
                            checked={schedule.morning.enabled}
                            onChange={() => handleShiftToggle("morning")}
                            className="h-3.5 w-3.5 rounded border-gray-300"
                            title="Activar/desactivar turno mañana"
                        />
                    </div>

                    {schedule.morning.enabled && (
                        <div className="flex items-center gap-2">
                            <input
                                type="time"
                                value={schedule.morning.start}
                                onChange={(e) => handleTimeChange("morning", "start", e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-muted-foreground">-</span>
                            <input
                                type="time"
                                value={schedule.morning.end}
                                onChange={(e) => handleTimeChange("morning", "end", e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    )}
                    {!schedule.morning.enabled && (
                        <div className="text-xs text-muted-foreground text-center py-1.5 italic">
                            No labora
                        </div>
                    )}
                </div>

                {/* Afternoon Shift */}
                <div className={`space-y-2 p-3 rounded-md border ${schedule.afternoon.enabled ? "border-border/50 bg-background/50" : "border-transparent bg-muted/20 opacity-70"
                    }`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tarde</span>
                        <input
                            type="checkbox"
                            checked={schedule.afternoon.enabled}
                            onChange={() => handleShiftToggle("afternoon")}
                            className="h-3.5 w-3.5 rounded border-gray-300"
                            title="Activar/desactivar turno tarde"
                        />
                    </div>

                    {schedule.afternoon.enabled && (
                        <div className="flex items-center gap-2">
                            <input
                                type="time"
                                value={schedule.afternoon.start}
                                onChange={(e) => handleTimeChange("afternoon", "start", e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-muted-foreground">-</span>
                            <input
                                type="time"
                                value={schedule.afternoon.end}
                                onChange={(e) => handleTimeChange("afternoon", "end", e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    )}
                    {!schedule.afternoon.enabled && (
                        <div className="text-xs text-muted-foreground text-center py-1.5 italic">
                            No labora
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
