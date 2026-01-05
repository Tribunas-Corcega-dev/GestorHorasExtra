"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"

function formatMinutesToTime(minutes) {
    if (!minutes) return "0h 0m"
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h ${m}m`
}

export function CompensatoryTimeWidget() {
    const { user } = useAuth()
    const [balance, setBalance] = useState(0)
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)

    // Form state
    const [tipo, setTipo] = useState("DIA_COMPLETO")
    const [fechaInicio, setFechaInicio] = useState("")
    const [fechaFin, setFechaFin] = useState("")
    const [minutosSolicitados, setMinutosSolicitados] = useState("")
    const [motivo, setMotivo] = useState("")
    const [submitting, setSubmitting] = useState(false)

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
                setBalance(data.saldo_minutos || 0)
                setHistory(data.historial || [])
            }
        } catch (error) {
            console.error("Error fetching balance:", error)
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setSubmitting(true)

        try {
            // Basic validation
            if (!minutosSolicitados || minutosSolicitados <= 0) {
                alert("Por favor ingrese una cantidad de tiempo válida")
                setSubmitting(false)
                return
            }

            const res = await fetch("/api/compensatorios/solicitar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tipo,
                    fecha_inicio: fechaInicio, // Should be full ISO string ideally, but basic date works if backend handles it? 
                    // Backend creates 'solicitudes_tiempo' with timestamps.
                    // The 'fecha_inicio' input is type="datetime-local" or just "date"?
                    // Let's use datetime-local to be precise for 'LLEGADA_TARDIA'.
                    fecha_fin: fechaFin || fechaInicio, // Fallback if single day/event
                    minutos_solicitados: parseInt(minutosSolicitados),
                    motivo
                })
            })

            const data = await res.json()
            if (res.ok) {
                alert("Solicitud creada exitosamente")
                setShowModal(false)
                setTipo("DIA_COMPLETO")
                setFechaInicio("")
                setFechaFin("")
                setMinutosSolicitados("")
                setMotivo("")
                fetchBalance() // Refresh pending status/balance perception
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

            <div className="mb-6">
                <span className="text-4xl font-bold text-primary">{formatMinutesToTime(balance)}</span>
                <span className="text-sm text-muted-foreground ml-2">disponibles</span>
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
                                    onChange={(e) => setTipo(e.target.value)}
                                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="DIA_COMPLETO">Día Completo</option>
                                    <option value="LLEGADA_TARDIA">Llegada Tardía</option>
                                    <option value="SALIDA_TEMPRANA">Salida Temprana</option>
                                    <option value="OTRO">Otro</option>
                                </select>
                            </div>

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

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Tiempo a descontar (minutos)</label>
                                <input
                                    type="number"
                                    value={minutosSolicitados}
                                    onChange={(e) => setMinutosSolicitados(e.target.value)}
                                    required
                                    min="1"
                                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="Ej: 480 para un día (8h)"
                                />
                                <p className="text-xs text-muted-foreground mt-1 text-right">
                                    Disponible: {balance} min
                                </p>
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
                                    disabled={submitting}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
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
