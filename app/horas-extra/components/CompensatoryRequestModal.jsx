import { useState, useEffect } from "react"

const LABELS = {
    extra_diurna: "Extra Diurna",
    extra_nocturna: "Extra Nocturna",
    extra_diurna_festivo: "Extra Diurna Festivo",
    extra_nocturna_festivo: "Extra Nocturna Festivo",
    recargo_nocturno: "Recargo Nocturno",
    dominical_festivo: "Dominical/Festivo",
    recargo_nocturno_festivo: "Recargo Nocturno Festivo"
}

const ALLOWED_TYPES = [
    "extra_diurna",
    "extra_nocturna",
    "extra_diurna_festivo",
    "extra_nocturna_festivo"
]

export function CompensatoryRequestModal({ isOpen, onClose, checkAvailable, onConfirm }) {
    const [requests, setRequests] = useState({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    useEffect(() => {
        if (isOpen) {
            setRequests({})
            setError("")
        }
    }, [isOpen])

    if (!isOpen) return null

    // availableData: { type: minutesAvailable }
    // e.g., { extra_diurna: 120, extra_nocturna: 60 }
    // We filter out any types with 0 minutes AND filter allow-list
    const availableTypes = Object.entries(checkAvailable)
        .filter(([type, mins]) => mins > 0 && ALLOWED_TYPES.includes(type))

    const handleInputChange = (type, field, value) => {
        setRequests(prev => {
            const current = prev[type] || { h: "", m: "" }
            return {
                ...prev,
                [type]: { ...current, [field]: value }
            }
        })
    }

    const handleSubmit = async () => {
        setError("")
        const formattedRequests = {}
        let hasValue = false

        for (const [type, available] of availableTypes) {
            const req = requests[type]
            if (req) {
                const h = parseInt(req.h) || 0
                const m = parseInt(req.m) || 0
                const totalReq = (h * 60) + m

                if (totalReq > available) {
                    setError(`La cantidad solicitada para ${LABELS[type]} excede lo disponible.`)
                    return
                }
                if (totalReq > 0) {
                    formattedRequests[type] = totalReq
                    hasValue = true
                }
            }
        }

        if (!hasValue) {
            setError("Debes ingresar al menos una cantidad a acumular.")
            return
        }

        setLoading(true)
        try {
            await onConfirm(formattedRequests)
            onClose()
        } catch (err) {
            setError("Error al procesar la solicitud.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-card w-full max-w-lg rounded-lg shadow-xl border border-border flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border">
                    <h2 className="text-xl font-bold text-foreground">Solicitar Compensatorio (Bolsa)</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Ingresa la cantidad de tiempo que deseas enviar a tu bolsa de horas.
                    </p>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {availableTypes.length === 0 ? (
                        <p className="text-center text-muted-foreground italic">No tienes horas extra disponibles para acumular.</p>
                    ) : (
                        availableTypes.map(([type, mins]) => {
                            const req = requests[type] || { h: "", m: "" }
                            return (
                                <div key={type} className="bg-muted/30 p-4 rounded-md border border-border">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="font-medium text-sm text-foreground">{LABELS[type] || type}</label>
                                        <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
                                            Disp: {Math.floor(mins / 60)}h {(mins % 60)}m
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 relative">
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                value={req.h}
                                                onChange={(e) => handleInputChange(type, 'h', e.target.value)}
                                                className="w-full pl-3 pr-8 py-2 text-sm border border-input rounded-md bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                                            />
                                            <span className="absolute right-3 top-2 text-xs text-muted-foreground pointer-events-none">h</span>
                                        </div>
                                        <span className="text-muted-foreground font-bold">:</span>
                                        <div className="flex-1 relative">
                                            <input
                                                type="number"
                                                min="0"
                                                max="59"
                                                placeholder="00"
                                                value={req.m}
                                                onChange={(e) => handleInputChange(type, 'm', e.target.value)}
                                                className="w-full pl-3 pr-8 py-2 text-sm border border-input rounded-md bg-background focus:ring-2 focus:ring-primary focus:border-transparent"
                                            />
                                            <span className="absolute right-3 top-2 text-xs text-muted-foreground pointer-events-none">m</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}

                    {error && (
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-md">
                            {error}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-border bg-muted/10 flex justify-end gap-3 rounded-b-lg">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || availableTypes.length === 0}
                        className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        Confirmar Solicitud
                    </button>
                </div>
            </div>
        </div>
    )
}
