"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
import { useRouter } from "next/navigation"

export function EmpleadosManager() {
    const { user } = useAuth()
    const router = useRouter()
    const [empleados, setEmpleados] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [areaFilter, setAreaFilter] = useState("")
    const [rolFilter, setRolFilter] = useState("")
    const [roles, setRoles] = useState([])
    const [areas, setAreas] = useState([])
    const [sortOrder, setSortOrder] = useState("asc")

    useEffect(() => {
        fetchEmpleados()
        fetchRoles()
    }, [search, areaFilter, rolFilter])

    async function fetchEmpleados() {
        try {
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            if (areaFilter) params.append("area", areaFilter)
            if (rolFilter) params.append("rol", rolFilter)

            const res = await fetch(`/api/empleados?${params}`)
            if (res.ok) {
                const data = await res.json()
                setEmpleados(data)

                // Extraer áreas únicas
                const uniqueAreas = [...new Set(data.map((e) => e.area).filter(Boolean))]
                setAreas(uniqueAreas)
            }
        } catch (error) {
            console.error("[v0] Error fetching employees:", error)
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

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-foreground">Empleados</h1>
                <Link
                    href="/empleados/nuevo"
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity font-medium"
                >
                    Nuevo Empleado
                </Link>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Buscar por nombre o usuario"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />

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

                <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    <option value="asc">Nombre (A-Z)</option>
                    <option value="desc">Nombre (Z-A)</option>
                </select>
            </div>

            {/* Tabla */}
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
                            <div key={empleado.id} className="bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {empleado.foto_url ? (
                                            <img src={empleado.foto_url} alt={empleado.nombre} className="h-full w-full object-cover" />
                                        ) : (
                                            <span className="text-xl font-bold text-primary">
                                                {(empleado.nombre || empleado.username || "?").charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg text-foreground line-clamp-1">
                                            {empleado.nombre || empleado.username}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">@{empleado.username}</p>
                                        {empleado.cc && (
                                            <p className="text-xs text-muted-foreground mt-0.5">CC: {empleado.cc}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 mb-6 flex-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Área:</span>
                                        <span className="font-medium text-foreground text-right">{empleado.area || "-"}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Rol:</span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                                            {empleado.rol}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-auto space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Link
                                            href={`/empleados/${empleado.id}/detalles`}
                                            className="flex items-center justify-center gap-1 px-3 py-2 border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            Perfil
                                        </Link>
                                        <Link
                                            href={`/empleados/${empleado.id}`}
                                            className="flex items-center justify-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Editar
                                        </Link>
                                    </div>
                                    <Link
                                        href={`/horas-extra/${empleado.id}/historial`}
                                        className="flex items-center justify-center gap-2 border border-input bg-background hover:bg-accent text-foreground px-4 py-2 rounded-md text-sm font-medium transition-colors w-full"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Ver Historial OT
                                    </Link>
                                </div>
                            </div>
                        ))}
                </div>
            )}
        </div>
    )
}
