"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageEmployees, isCoordinator } from "@/lib/permissions"
import { useRouter } from "next/navigation"
import { ScheduleSelector } from "@/components/ScheduleSelector"

export default function NuevoEmpleadoPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <NuevoEmpleadoContent />
      </Layout>
    </ProtectedRoute>
  )
}

function NuevoEmpleadoContent() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [roles, setRoles] = useState([])

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    nombre: "",
    cargo: "",
    area: "",
    tipo_trabajador: "",
    salario_base: "",
    jornada_fija_hhmm: "",
    rol: "OPERARIO",
  })

  useEffect(() => {
    if (user && (!canManageEmployees(user.rol) || isCoordinator(user.rol))) {
      router.push("/dashboard")
    }
    fetchRoles()
  }, [user, router])

  useEffect(() => {
    // Si es coordinador, establecer su área por defecto
    if (user && isCoordinator(user.rol)) {
      setFormData((prev) => ({ ...prev, area: user.area }))
    }
  }, [user])

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

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  function handleScheduleChange(newSchedule) {
    setFormData((prev) => ({ ...prev, jornada_fija_hhmm: newSchedule }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/empleados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || "Error al crear empleado")
      }

      router.push("/empleados")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!canManageEmployees(user?.rol) || isCoordinator(user?.rol)) {
    return null
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Nuevo Empleado</h1>

      <div className="bg-card border border-border rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
                Usuario *
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                Contraseña *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label htmlFor="nombre" className="block text-sm font-medium text-foreground mb-1">
              Nombre completo
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              value={formData.nombre}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cargo" className="block text-sm font-medium text-foreground mb-1">
                Cargo
              </label>
              <input
                id="cargo"
                name="cargo"
                type="text"
                value={formData.cargo}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="area" className="block text-sm font-medium text-foreground mb-1">
                Área
              </label>
              <input
                id="area"
                name="area"
                type="text"
                value={formData.area}
                onChange={handleChange}
                disabled={isCoordinator(user?.rol)}
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tipo_trabajador" className="block text-sm font-medium text-foreground mb-1">
                Tipo de trabajador
              </label>
              <input
                id="tipo_trabajador"
                name="tipo_trabajador"
                type="text"
                value={formData.tipo_trabajador}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="rol" className="block text-sm font-medium text-foreground mb-1">
                Rol
              </label>
              <select
                id="rol"
                name="rol"
                value={formData.rol}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {roles.map((rol) => (
                  <option key={rol} value={rol}>
                    {rol}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="salario_base" className="block text-sm font-medium text-foreground mb-1">
                Salario base
              </label>
              <input
                id="salario_base"
                name="salario_base"
                type="number"
                step="0.01"
                value={formData.salario_base}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">
                Horario de trabajo (Jornada Fija)
              </label>
              <ScheduleSelector
                value={formData.jornada_fija_hhmm}
                onChange={handleScheduleChange}
              />
            </div>
          </div>

          {error && <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
            >
              {loading ? "Guardando..." : "Guardar empleado"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/empleados")}
              className="px-6 py-2 border border-border rounded-md hover:bg-accent transition-colors text-foreground font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
