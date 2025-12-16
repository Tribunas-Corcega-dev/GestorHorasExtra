"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageOvertime, isCoordinator } from "@/lib/permissions"
import { useRouter } from "next/navigation"

export default function HorasExtraPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <HorasExtraContent />
            </Layout>
        </ProtectedRoute>
    )
}

function HorasExtraContent() {
    const { user } = useAuth()
    const router = useRouter()
    const [empleados, setEmpleados] = useState([])
    const [loading, setLoading] = useState(true)

    // New search/filter state
    const [search, setSearch] = useState("")
    const [areaFilter, setAreaFilter] = useState("")
    const [rolFilter, setRolFilter] = useState("")
    const [roles, setRoles] = useState([])
    const [areas, setAreas] = useState([])
    const [sortOrder, setSortOrder] = useState("asc")

    useEffect(() => {
        if (user) {
            if (user.rol === "OPERARIO") {
                router.push(`/horas-extra/${user.id}/historial`)
            } else if (!canManageOvertime(user.rol)) {
                router.push("/dashboard")
            }
        }
    }, [user, router])

    // Fetch roles once
    useEffect(() => {
        fetchRoles()
    }, [])

    // Fetch employees when user becomes available or filters/search change
    useEffect(() => {
        if (user && canManageOvertime(user.rol)) {
            fetchEmpleados()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, search, areaFilter, rolFilter])

    async function fetchEmpleados() {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            if (areaFilter) params.append("area", areaFilter)
            if (rolFilter) params.append("rol", rolFilter)

            const res = await fetch(`/api/empleados?${params}`)
            if (res.ok) {
                const data = await res.json()
                setEmpleados(data)

                // Extract unique areas
                const uniqueAreas = [...new Set(data.map((e) => e.area).filter(Boolean))]
                setAreas(uniqueAreas)
            } else {
                setEmpleados([])
            }
        } catch (error) {
            console.error("[v0] Error fetching employees:", error)
            setEmpleados([])
        } finally {
            setLoading(false)
        }
    }

    async function fetchRoles() {
        try {
            const res = await fetch("/api/roles")
            if (res.ok) {
                const data = await res.json()
                setRoles(data)
            }
        } catch (error) {
            console.error("[v0] Error fetching roles:", error)
        }
    }

    const handleRegistrarHoras = (empleado) => {
        router.push(`/horas-extra/${empleado.id}/registrar`)
    }

    if (!canManageOvertime(user?.rol)) {
        return null
    }

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6 text-foreground">Gestión de Horas Extra</h1>

            {/* Filters: search, area, role */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Buscar por nombre o usuario"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />

                {!isCoordinator(user?.rol) && (
                    <>
                        <select
                            value={areaFilter}
                            onChange={(e) => setAreaFilter(e.target.value)}
                            className="px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">Todas las áreas</option>
                            {areas.map((area) => (
                                <option key={area} value={area}>
                                    {area}
                                </option>
                            ))}
                        </select>

                        <select
                            value={rolFilter}
                            onChange={(e) => setRolFilter(e.target.value)}
                            className="px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">Todos los roles</option>
                            {roles.map((rol) => (
                                <option key={rol} value={rol}>
                                    {rol}
                                </option>
                            ))}
                        </select>
                    </>
                )}

                <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <option value="asc">Nombre (A-Z)</option>
                    <option value="desc">Nombre (Z-A)</option>
                </select>
            </div>

            {loading ? (
                <div className="text-center py-8">Cargando...</div>
            ) : empleados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No se encontraron empleados</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {empleados
                        .sort((a, b) => {
                            const nameA = (a.nombre || a.username || "").trim().toLowerCase()
                            const nameB = (b.nombre || b.username || "").trim().toLowerCase()
                            return sortOrder === "asc"
                                ? nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
                                : nameB.localeCompare(nameA, 'es', { sensitivity: 'base' })
                        })
                        .map((empleado) => (
                            <div key={empleado.id} className="bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col items-center text-center">
                                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4 overflow-hidden relative">
                                    {empleado.foto_url ? (
                                        <img
                                            src={empleado.foto_url}
                                            alt={`Foto de ${empleado.nombre || empleado.username}`}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-2xl font-bold text-primary">
                                            {(empleado.nombre || empleado.username || "?").charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                <h3 className="font-semibold text-lg text-foreground mb-1">
                                    {empleado.nombre || empleado.username}
                                </h3>

                                <div className="text-sm text-muted-foreground mb-4 space-y-1">
                                    <p className="text-xs bg-muted px-2 py-1 rounded-full inline-block">
                                        {empleado.area || "Sin área"}
                                    </p>
                                </div>

                                <div className="mt-auto w-full space-y-2">
                                    <button
                                        onClick={() => handleRegistrarHoras(empleado)}
                                        className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                                    >
                                        Registrar horas extra
                                    </button>
                                    <button
                                        onClick={() => router.push(`/horas-extra/${empleado.id}/historial`)}
                                        className="w-full bg-secondary text-secondary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity border border-border"
                                    >
                                        Ver historial
                                    </button>
                                </div>
                            </div>
                        ))}
                </div>
            )}
        </div>
    )
}
