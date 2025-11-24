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
    morning: { start: "08:00", end: "12:00", enabled: true },
    afternoon: { start: "13:00", end: "17:00", enabled: true },
}

export function ScheduleSelector({ value, onChange }) {
    const [schedule, setSchedule] = useState(() => {
        if (value) {
            try {
                return typeof value === "string" ? JSON.parse(value) : value
            } catch (e) {
                console.error("Error parsing schedule value:", e)
            }
        }

        const initial = {}
        DAYS.forEach((day) => {
            initial[day.id] = { ...DEFAULT_DAY_SCHEDULE }
            if (day.id === "sabado" || day.id === "domingo") {
                initial[day.id].enabled = false
            }
        })
        return initial
    })

    const [copyModalOpen, setCopyModalOpen] = useState(false)
    const [sourceDayForCopy, setSourceDayForCopy] = useState(null)
    const [selectedDaysForCopy, setSelectedDaysForCopy] = useState([])

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

    const handleShiftToggle = (dayId, period) => {
        setSchedule((prev) => ({
            ...prev,
            [dayId]: {
                ...prev[dayId],
                [period]: {
                    ...prev[dayId][period],
                    enabled: !prev[dayId][period].enabled,
                },
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

    const openCopyModal = (dayId) => {
        setSourceDayForCopy(dayId)
        setSelectedDaysForCopy([])
        setCopyModalOpen(true)
    }

    const toggleDaySelection = (dayId) => {
        setSelectedDaysForCopy((prev) =>
            prev.includes(dayId)
                ? prev.filter(id => id !== dayId)
                : [...prev, dayId]
        )
    }

    const executeCopy = () => {
        if (!sourceDayForCopy || selectedDaysForCopy.length === 0) return

        const sourceSchedule = schedule[sourceDayForCopy]

        setSchedule((prev) => {
            const newSchedule = { ...prev }
            selectedDaysForCopy.forEach((targetDayId) => {
                newSchedule[targetDayId] = {
                    ...JSON.parse(JSON.stringify(sourceSchedule)),
                    enabled: true,
                }
            })
            return newSchedule
        })

        setCopyModalOpen(false)
        setSourceDayForCopy(null)
        setSelectedDaysForCopy([])
    }

    return (
        <div className="space-y-4 relative">
            {/* Copy Modal */}
            {copyModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-card border border-border rounded-lg shadow-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4 text-foreground">
                            Copiar horario de {DAYS.find(d => d.id === sourceDayForCopy)?.label}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Selecciona los días a los que deseas copiar este horario:
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {DAYS.filter(d => d.id !== sourceDayForCopy).map((day) => (
                                <label
                                    key={day.id}
                                    className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${selectedDaysForCopy.includes(day.id)
                                            ? "bg-primary/10 border-primary"
                                            : "bg-background border-input hover:bg-accent"
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedDaysForCopy.includes(day.id)}
                                        onChange={() => toggleDaySelection(day.id)}
                                        className="mr-3 h-4 w-4"
                                    />
                                    <span className="text-sm font-medium text-foreground">{day.label}</span>
                                </label>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setCopyModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-input rounded-md hover:bg-accent"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={executeCopy}
                                disabled={selectedDaysForCopy.length === 0}
                                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:opacity-90 disabled:opacity-50"
                            >
                                Copiar en seleccionados
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                    onClick={() => openCopyModal(day.id)}
                                    className="text-xs text-primary hover:underline font-medium"
                                    title="Copiar este horario a días seleccionados"
                                >
                                    Copiar en seleccionados
                                </button>
                            )}
                        </div>

                        {schedule[day.id]?.enabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
                                {/* Morning Shift */}
                                <div className={`space-y-2 p-3 rounded-md border ${schedule[day.id].morning.enabled ? "border-border/50 bg-background/50" : "border-transparent bg-muted/20 opacity-70"
                                    }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mañana</span>
                                        <input
                                            type="checkbox"
                                            checked={schedule[day.id].morning.enabled}
                                            onChange={() => handleShiftToggle(day.id, "morning")}
                                            className="h-3.5 w-3.5 rounded border-gray-300"
                                            title="Activar/desactivar turno mañana"
                                        />
                                    </div>

                                    {schedule[day.id].morning.enabled && (
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
                                    )}
                                    {!schedule[day.id].morning.enabled && (
                                        <div className="text-xs text-muted-foreground text-center py-1.5 italic">
                                            No labora
                                        </div>
                                    )}
                                </div>

                                {/* Afternoon Shift */}
                                <div className={`space-y-2 p-3 rounded-md border ${schedule[day.id].afternoon.enabled ? "border-border/50 bg-background/50" : "border-transparent bg-muted/20 opacity-70"
                                    }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tarde</span>
                                        <input
                                            type="checkbox"
                                            checked={schedule[day.id].afternoon.enabled}
                                            onChange={() => handleShiftToggle(day.id, "afternoon")}
                                            className="h-3.5 w-3.5 rounded border-gray-300"
                                            title="Activar/desactivar turno tarde"
                                        />
                                    </div>

                                    {schedule[day.id].afternoon.enabled && (
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
                                    )}
                                    {!schedule[day.id].afternoon.enabled && (
                                        <div className="text-xs text-muted-foreground text-center py-1.5 italic">
                                            No labora
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
