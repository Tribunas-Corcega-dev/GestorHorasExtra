"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageEmployees, isWorker } from "@/lib/permissions"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function EmpleadosPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <EmpleadosContent />
      </Layout>
    </ProtectedRoute>
  )
}

function EmpleadosContent() {
  const { user } = useAuth()
  const router = useRouter()
  const [empleados, setEmpleados] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [areaFilter, setAreaFilter] = useState("")
  const [rolFilter, setRolFilter] = useState("")
  const [roles, setRoles] = useState([])
  const [areas, setAreas] = useState([])

  // Verificar permisos
  useEffect(() => {
    if (user && isWorker(user.rol)) {
      router.push("/dashboard")
    }
  }, [user, router])

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

  if (!canManageEmployees(user?.rol)) {
    return null
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
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-8">Cargando...</div>
      ) : empleados.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No se encontraron empleados</div>
      ) : (
        <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Usuario</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Nombre</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Cargo</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Área</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Rol</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {empleados.map((empleado) => (
                  <tr key={empleado.id} className="hover:bg-accent transition-colors">
                    <td className="px-4 py-3 text-sm text-foreground">{empleado.username}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{empleado.nombre || "-"}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{empleado.cargo || "-"}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{empleado.area || "-"}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{empleado.rol}</td>
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/empleados/${empleado.id}`} className="text-primary hover:underline font-medium">
                        Ver/Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
