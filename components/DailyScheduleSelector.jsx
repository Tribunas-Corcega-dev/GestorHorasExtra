"use client"

import { useState, useEffect } from "react"

const DEFAULT_SCHEDULE = {
    enabled: true,
    es_festivo: false,
    morning: { start: "07:30", end: "12:00", enabled: true },
    afternoon: { start: "13:45", end: "17:00", enabled: true },
}

export function DailyScheduleSelector({ value, onChange, date }) {
    // 1. Derive state directly from props (Controlled Component)
    // We do not use internal useState for 'schedule' to avoid sync loops.
    // Instead we merge the incoming prop with defaults on every render.

    // Helper to safely parse if string
    const safeParse = (v) => {
        try {
            return typeof v === 'string' ? JSON.parse(v) : v
        } catch { return {} }
    }

    const raw = safeParse(value) || {}

    // Deep merge to ensure all fields exist
    const schedule = {
        ...DEFAULT_SCHEDULE,
        ...raw,
        // Override nested objects only if present, but keep defaults if missing keys
        morning: { ...DEFAULT_SCHEDULE.morning, ...(raw.morning || {}) },
        afternoon: { ...DEFAULT_SCHEDULE.afternoon, ...(raw.afternoon || {}) },
        // Ensure es_festivo is explicit
        es_festivo: raw.es_festivo ?? DEFAULT_SCHEDULE.es_festivo
    }

    // 2. Handle Date Changes (Auto-detect Sunday)
    // We only trigger onChange if the computed requirements (DayOfWeek/Festivo) differ from current data.
    // This allows the Parent to update the source of truth.
    useEffect(() => {
        if (date) {
            const dayOfWeek = getDayOfWeek(date)
            const isSunday = dayOfWeek === "Domingo"

            // Check if we need to update the parent to reflect the date context
            // We use the derived 'schedule' here.
            const needsUpdate =
                schedule.dayOfWeek !== dayOfWeek ||
                (isSunday && !schedule.es_festivo)

            if (needsUpdate) {
                onChange({
                    ...schedule,
                    dayOfWeek,
                    es_festivo: isSunday ? true : schedule.es_festivo
                })
            }
        }
        // ESLint warning about dependencies: 
        // We knowingly use 'date' as the trigger. 'schedule' and 'onChange' are used but 
        // including them (especially schedule, which changes on every parent update) can cause loops 
        // if we are not careful. However, since we have the `needsUpdate` guard, it *should* be safe 
        // even with them, but relying on 'date' change is the intended trigger logic here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [date])

    function getDayOfWeek(dateString) {
        if (!dateString) return ""
        // Create date object and adjust for timezone offset to get correct local day
        const d = new Date(dateString)
        const day = d.getUTCDay()

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

    // 3. Handlers call onChange directly with the new object
    const handleShiftToggle = (period) => {
        onChange({
            ...schedule,
            [period]: {
                ...schedule[period],
                enabled: !schedule[period].enabled,
            },
        })
    }

    const handleTimeChange = (period, field, time) => {
        onChange({
            ...schedule,
            [period]: {
                ...schedule[period],
                [field]: time,
            },
        })
    }

    const handleFestivoChange = (e) => {
        const isSunday = schedule.dayOfWeek === "Domingo"
        // Prevent unchecking if it's Sunday
        if (isSunday && !e.target.checked) return

        onChange({
            ...schedule,
            es_festivo: e.target.checked
        })
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
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <input
                                type="time"
                                value={schedule.morning.start}
                                onChange={(e) => handleTimeChange("morning", "start", e.target.value)}
                                className="w-full flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-muted-foreground hidden sm:block">-</span>
                            <input
                                type="time"
                                value={schedule.morning.end}
                                onChange={(e) => handleTimeChange("morning", "end", e.target.value)}
                                className="w-full flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
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
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <input
                                type="time"
                                value={schedule.afternoon.start}
                                onChange={(e) => handleTimeChange("afternoon", "start", e.target.value)}
                                className="w-full flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-muted-foreground hidden sm:block">-</span>
                            <input
                                type="time"
                                value={schedule.afternoon.end}
                                onChange={(e) => handleTimeChange("afternoon", "end", e.target.value)}
                                className="w-full flex-1 px-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:ring-1 focus:ring-primary"
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
