"use client"

import { useState, useEffect } from "react"

const DAYS = [
    { id: "lunes", label: "Lunes" },
    { id: "martes", label: "Martes" },
    { id: "miercoles", label: "Miércoles" },
    { id: "jueves", label: "Jueves" },
    { id: "viernes", label: "Viernes" },
    { id: "sabado", label: "Sábado" },
    { id: "domingo", label: "Domingo" },
]

const DEFAULT_DAY_SCHEDULE = {
    enabled: true,
    morning: { start: "08:00", end: "12:00" },
    afternoon: { start: "13:00", end: "17:00" },
}

export function ScheduleSelector({ value, onChange }) {
    const [schedule, setSchedule] = useState(() => {
        // Initialize with default structure if value is empty or invalid
        if (value) {
            try {
                return typeof value === "string" ? JSON.parse(value) : value
            } catch (e) {
                console.error("Error parsing schedule value:", e)
            }
        }

        // Default initialization
        const initial = {}
        DAYS.forEach((day) => {
            initial[day.id] = { ...DEFAULT_DAY_SCHEDULE }
            // Disable weekends by default
            if (day.id === "sabado" || day.id === "domingo") {
                initial[day.id].enabled = false
            }
        })
        return initial
    })

    // Update parent whenever local state changes
    useEffect(() => {
        onChange(JSON.stringify(schedule))
    }, [schedule])

    const handleDayToggle = (dayId) => {
        setSchedule((prev) => ({
            ...prev,
            [dayId]: {
                ...prev[dayId],
                enabled: !prev[dayId].enabled,
            },
        }))
    }

    const handleTimeChange = (dayId, period, field, time) => {
        setSchedule((prev) => ({
            ...prev,
            [dayId]: {
                ...prev[dayId],
                [period]: {
                    ...prev[dayId][period],
                    [field]: time,
                },
            },
        }))
    }

    const copyToAllDays = (sourceDayId) => {
        const sourceSchedule = schedule[sourceDayId]
        setSchedule((prev) => {
            const newSchedule = { ...prev }
            DAYS.forEach((day) => {
                if (day.id !== sourceDayId) {
                    newSchedule[day.id] = {
                        ...JSON.parse(JSON.stringify(sourceSchedule)), // Deep copy
                        enabled: true, // Enable target days when copying
                    }
                }
            })
            return newSchedule
        })
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4">
                {DAYS.map((day) => (
                    <div
                        key={day.id}
                        className={`p-4 border rounded-lg transition-colors ${schedule[day.id]?.enabled ? "bg-card border-border" : "bg-muted/30 border-border/50"
                            }`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id={`enable-${day.id}`}
                                    checked={schedule[day.id]?.enabled}
                                    onChange={() => handleDayToggle(day.id)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <label htmlFor={`enable-${day.id}`} className="font-medium text-foreground cursor-pointer select-none">
                                    {day.label}
                                </label>
                            </div>

                            {schedule[day.id]?.enabled && (
                                <button
                                    type="button"
                                    onClick={() => copyToAllDays(day.id)}
                                    className="text-xs text-primary hover:underline"
                                    title="Copiar este horario a todos los demás días"
                                >
                                    Copiar a todos
                                </button>
                            )}
                        </div>

                        {schedule[day.id]?.enabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
                                {/* Morning Shift */}
                                <div className="space-y-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mañana</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="time"
                                            value={schedule[day.id].morning.start}
                                            onChange={(e) => handleTimeChange(day.id, "morning", "start", e.target.value)}
                                            className="flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                                        />
                                        <span className="text-muted-foreground">-</span>
                                        <input
                                            type="time"
                                            value={schedule[day.id].morning.end}
                                            onChange={(e) => handleTimeChange(day.id, "morning", "end", e.target.value)}
                                            className="flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                </div>

                                {/* Afternoon Shift */}
                                <div className="space-y-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tarde</span>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="time"
                                            value={schedule[day.id].afternoon.start}
                                            onChange={(e) => handleTimeChange(day.id, "afternoon", "start", e.target.value)}
                                            className="flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                                        />
                                        <span className="text-muted-foreground">-</span>
                                        <input
                                            type="time"
                                            value={schedule[day.id].afternoon.end}
                                            onChange={(e) => handleTimeChange(day.id, "afternoon", "end", e.target.value)}
                                            className="flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
