import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { canManageEmployees } from "@/lib/permissions"
import { formatToAmPm } from "@/lib/calculations"

const DAYS = [
    { id: "lunes", label: "Lunes" },
    { id: "martes", label: "Martes" },
    { id: "miercoles", label: "Miércoles" },
    { id: "jueves", label: "Jueves" },
    { id: "viernes", label: "Viernes" },
    { id: "sabado", label: "Sábado" },
    { id: "domingo", label: "Domingo" },
]

export function EmployeeDetailsView({ employeeId, showBackButton = true }) {
    const router = useRouter()
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [empleado, setEmpleado] = useState(null)
    const [showImageModal, setShowImageModal] = useState(false) // New state for image modal

    useEffect(() => {
        if (employeeId) {
            fetchEmpleado()
        }
    }, [employeeId])

    async function fetchEmpleado() {
        try {
            const res = await fetch(`/api/empleados/${employeeId}`)
            if (res.ok) {
                const data = await res.json()
                // Parse jornada_fija_hhmm if it's a string (handle potential double stringification)
                if (data.jornada_fija_hhmm) {
                    try {
                        let schedule = data.jornada_fija_hhmm
                        if (typeof schedule === 'string') {
                            schedule = JSON.parse(schedule)
                        }
                        // Check if it's STILL a string after first parse (double encoded)
                        if (typeof schedule === 'string') {
                            schedule = JSON.parse(schedule)
                        }
                        data.jornada_fija_hhmm = schedule
                    } catch (e) {
                        console.error("Error parsing schedule:", e)
                    }
                }
                setEmpleado(data)
            }
        } catch (error) {
            console.error("Error fetching employee:", error)
        } finally {
            setLoading(false)
        }
    }





    if (loading) {
        return <div className="text-center py-8">Cargando...</div>
    }

    if (!empleado) {
        return <div className="text-center py-8 text-muted-foreground">No se pudo cargar la información</div>
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-foreground">
                    {showBackButton ? "Detalles del Empleado" : "Mi Perfil"}
                </h1>
                {showBackButton && (
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors text-foreground text-sm font-medium"
                    >
                        Volver
                    </button>
                )}
            </div>

            <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                {/* Header / Banner */}
                <div className="bg-primary/10 p-8 flex flex-col items-center border-b border-border">
                    <div className="relative group">
                        <div
                            onClick={() => empleado.foto_url && setShowImageModal(true)}
                            className={`h-32 w-32 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-5xl font-bold mb-4 shadow-md overflow-hidden border-4 border-background ${empleado.foto_url ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                        >
                            {empleado.foto_url ? (
                                <img src={empleado.foto_url} alt={empleado.nombre} className="h-full w-full object-cover" />
                            ) : (
                                (empleado.nombre || empleado.username || "?").charAt(0).toUpperCase()
                            )}
                        </div>

                        {/* Edit Button - Small Icon (Only if canEditPhoto) */}

                    </div>

                    <h2 className="text-2xl font-bold text-foreground">{empleado.nombre || empleado.username}</h2>
                    <p className="text-muted-foreground font-medium">@{empleado.username}</p>
                    <div className="mt-4 flex gap-2">
                        <span className="px-3 py-1 bg-background rounded-full text-xs font-medium border border-border shadow-sm">
                            {empleado.area || "Sin área"}
                        </span>
                    </div>
                </div>

                {/* Details Content */}
                <div className="p-8 space-y-8">

                    {/* Info Laboral Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
                            Información Laboral
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-4 bg-background rounded-lg border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Cédula</p>
                                <p className="font-medium text-foreground text-lg">{empleado.cc || "-"}</p>
                            </div>
                            <div className="p-4 bg-background rounded-lg border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Rol en sistema</p>
                                <p className="font-medium text-foreground text-lg">{empleado.rol}</p>
                            </div>
                            <div className="p-4 bg-background rounded-lg border border-border">
                                <p className="text-xs text-muted-foreground mb-1">Salario Base</p>
                                <p className="font-medium text-foreground text-lg">
                                    {empleado.salario_base ? `$${Number(empleado.salario_base).toLocaleString()}` : "-"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Horario Semanal Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
                            Horario Semanal
                        </h3>
                        {empleado.jornada_fija_hhmm ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {DAYS.map((day) => {
                                    const daySchedule = empleado.jornada_fija_hhmm[day.id]
                                    const isDayEnabled = daySchedule?.enabled

                                    return (
                                        <div key={day.id} className={`p-3 rounded-md border ${isDayEnabled ? "border-border bg-card" : "border-border/50 bg-muted/30"}`}>
                                            <div className="font-medium text-sm mb-2 flex items-center justify-between">
                                                <span>{day.label}</span>
                                                {!isDayEnabled && <span className="text-xs text-muted-foreground italic">Descanso</span>}
                                            </div>

                                            {isDayEnabled ? (
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">M:</span>
                                                        <span className="font-medium">
                                                            {daySchedule.morning?.enabled
                                                                ? `${formatToAmPm(daySchedule.morning.start)} - ${formatToAmPm(daySchedule.morning.end)}`
                                                                : "No labora"}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">T:</span>
                                                        <span className="font-medium">
                                                            {daySchedule.afternoon?.enabled
                                                                ? `${formatToAmPm(daySchedule.afternoon.start)} - ${formatToAmPm(daySchedule.afternoon.end)}`
                                                                : "No labora"}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-xs text-muted-foreground italic text-center py-2">
                                                    No programado
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No hay horario fijo registrado</p>
                        )}
                    </div>
                </div>
            </div>
            {/* Image Modal */}
            {showImageModal && empleado.foto_url && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowImageModal(false)}
                >
                    <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
                        <img
                            src={empleado.foto_url}
                            alt={empleado.nombre}
                            className="max-w-full max-h-full rounded-md shadow-2xl object-contain"
                        />
                        <button
                            onClick={() => setShowImageModal(false)}
                            className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
