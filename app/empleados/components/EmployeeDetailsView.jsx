import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { canManageEmployees } from "@/lib/permissions"

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
    const [uploading, setUploading] = useState(false)

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

    async function handleImageSelect(e) {
        const file = e.target.files[0]
        if (!file || !empleado) return

        try {
            setUploading(true)
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random()}.${fileExt}`
            const filePath = `${empleado.cc}/${fileName}`

            // 1. Upload file
            const uploadFormData = new FormData()
            uploadFormData.append("file", file)
            uploadFormData.append("path", filePath)

            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: uploadFormData,
            })

            if (!uploadRes.ok) throw new Error("Error al subir imagen")

            const { publicUrl } = await uploadRes.json()

            // 2. Update user profile with new photo URL
            const updateRes = await fetch(`/api/empleados/${employeeId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ foto_url: publicUrl })
            })

            if (!updateRes.ok) throw new Error("Error al actualizar perfil")

            // 3. Update local state
            setEmpleado(prev => ({ ...prev, foto_url: publicUrl }))
            alert("Foto actualizada correctamente")

        } catch (error) {
            console.error("Error updating photo:", error)
            alert("Error al actualizar la foto")
        } finally {
            setUploading(false)
        }
    }

    const canEditPhoto = user && canManageEmployees(user.rol)

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
                        <div className="h-32 w-32 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-5xl font-bold mb-4 shadow-md overflow-hidden border-4 border-background">
                            {empleado.foto_url ? (
                                <img src={empleado.foto_url} alt={empleado.nombre} className="h-full w-full object-cover" />
                            ) : (
                                (empleado.nombre || empleado.username || "?").charAt(0).toUpperCase()
                            )}
                        </div>

                        {/* Overlay for uploading */}
                        {canEditPhoto && (
                            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer mb-4">
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageSelect}
                                    disabled={uploading}
                                />
                                <span className="text-white text-xs font-medium px-2 text-center">
                                    {uploading ? "Subiendo..." : "Cambiar Foto"}
                                </span>
                            </label>
                        )}
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
                                                                ? `${daySchedule.morning.start} - ${daySchedule.morning.end}`
                                                                : "No labora"}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">T:</span>
                                                        <span className="font-medium">
                                                            {daySchedule.afternoon?.enabled
                                                                ? `${daySchedule.afternoon.start} - ${daySchedule.afternoon.end}`
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
        </div>
    )
}
