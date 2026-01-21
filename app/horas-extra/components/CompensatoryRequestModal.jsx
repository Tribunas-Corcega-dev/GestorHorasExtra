
import { useState, useEffect } from "react"
import { formatMinutesToHHMM } from "@/hooks/useOvertimeCalculator"

const LABELS = {
    extra_diurna: "Extra Diurna",
    extra_nocturna: "Extra Nocturna",
    extra_diurna_festivo: "Extra Diurna Festivo",
    extra_nocturna_festivo: "Extra Nocturna Festivo"
}

export function CompensatoryRequestModal({ isOpen, onClose, checkAvailable, onConfirm }) {
    const [selectedType, setSelectedType] = useState("extra_diurna")
    const [hours, setHours] = useState("")
    const [minutes, setMinutes] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    if (!isOpen) return null

    // Determine available hours for display
    const available = checkAvailable || {}

    const handleSubmit = async () => {
        setError("")
        const h = parseInt(hours || "0", 10)
        const m = parseInt(minutes || "0", 10)
        const totalMinutes = h * 60 + m

        if (totalMinutes <= 0) {
            setError("Por favor ingresa una cantidad válida.")
            return
        }

        const maxAvailable = available[selectedType] || 0
        if (totalMinutes > maxAvailable) {
            setError(`No tienes suficientes horas disponibles en ${LABELS[selectedType]}. Disponible: ${formatMinutesToFloat(maxAvailable)}`)
            return
        }

        const requests = {
            [selectedType]: totalMinutes
        }

        setLoading(true)
        try {
            await onConfirm(requests)
            onClose()
            // Reset form
            setHours("")
            setMinutes("")
            setSelectedType("extra_diurna")
        } catch (err) {
            setError("Error al procesar la solicitud.")
        } finally {
            setLoading(false)
        }
    }

    const availableTypes = Object.entries(available).filter(([k, v]) => v > 0 && LABELS[k])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card border border-border rounded-xl shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-200">
                <h2 className="text-xl font-bold mb-2">Solicitar Compensatorio (Bolsa)</h2>
                <p className="text-sm text-muted-foreground mb-6">
                    Ingresa la cantidad de tiempo que deseas enviar a tu bolsa de horas.
                </p>

                {/* Summary of Available Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {Object.entries(LABELS).map(([type, label]) => {
                        const mins = available[type] || 0
                        if (mins <= 0) return null
                        return (
                            <div key={type} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-md p-3 flex items-center justify-between gap-3">
                                <span className="text-sm font-medium text-muted-foreground truncate" title={label}>{label}</span>
                                <span className="font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">{formatMinutesToFloat(mins)}</span>
                            </div>
                        )
                    })}
                    {/* Show empty state if nothing available */}
                    {Object.values(available).every(m => m <= 0) && (
                        <p className="col-span-2 text-sm text-amber-600 text-center py-2">No tienes horas extra disponibles para auditar.</p>
                    )}
                </div>

                <div className="space-y-4">
                    {/* Type Selector */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Tipo de Hora</label>
                        <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value)}
                            className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                        >
                            {Object.entries(LABELS).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                            Disponible: <span className="font-medium">{formatMinutesToFloat(available[selectedType] || 0)}</span>
                        </p>
                    </div>

                    {/* Time Input */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <label className="block text-xs text-muted-foreground mb-1">Horas</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    value={hours}
                                    onChange={(e) => setHours(e.target.value)}
                                    placeholder="0"
                                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm pr-8"
                                />
                                <span className="absolute right-3 top-2 text-muted-foreground text-sm">h</span>
                            </div>
                        </div>
                        <span className="mt-5 text-muted-foreground font-bold">:</span>
                        <div className="flex-1">
                            <label className="block text-xs text-muted-foreground mb-1">Minutos</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={minutes}
                                    onChange={(e) => setMinutes(e.target.value)}
                                    placeholder="00"
                                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm pr-8"
                                />
                                <span className="absolute right-3 top-2 text-muted-foreground text-sm">m</span>
                            </div>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <div className="mt-8 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {loading ? "Procesando..." : "Confirmar Solicitud"}
                    </button>
                </div>
            </div>
        </div>
    )
}

function formatMinutesToFloat(minutes) {
    if (!minutes) return "0h"
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins > 0 ? `${mins}m` : ''}`
}
