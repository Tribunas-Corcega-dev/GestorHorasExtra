"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageEmployees, isCoordinator } from "@/lib/permissions"
import { useRouter, useParams } from "next/navigation"
import { ScheduleSelector } from "@/components/ScheduleSelector"
import { supabase } from "@/lib/supabaseClient"

export default function EditarEmpleadoPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <EditarEmpleadoContent />
      </Layout>
    </ProtectedRoute>
  )
}

function EditarEmpleadoContent() {
  const params = useParams()
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [roles, setRoles] = useState([])
  const [defaultSchedules, setDefaultSchedules] = useState(null)
  const [minWage, setMinWage] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleting, setDeleting] = useState(false)

  const AREA_MAPPING = {
    "Acueducto": "h_acueducto",
    "Alcantarillado": "h_alcantarillado",
    "Aseo": "h_aseo",
    "Operario Bocatoma": "h_op_bocatoma",
    "Administrativo": "h_admin",
    "Planta Tratamiento": "h_planta_tratamiento"
  }

  const [formData, setFormData] = useState({
    nombre: "",
    cc: "",
    foto_url: "",
    cargo: "",
    area: "",
    tipo_trabajador: "",
    salario_base: "",
    jornada_fija_hhmm: "",
    rol: "",
    password: "",
  })

  const [originalData, setOriginalData] = useState(null)

  useEffect(() => {
    if (user && !canManageEmployees(user.rol)) {
      router.push("/dashboard")
    }
    if (params?.id) {
      fetchEmpleado()
      fetchRoles()
      fetchDefaultSchedules()
      fetchParameters()
    }
  }, [user, router, params?.id])

  async function fetchEmpleado() {
    try {
      const res = await fetch(`/api/empleados/${params.id}`)
      if (!res.ok) {
        throw new Error("No se pudo cargar el empleado")
      }
      const data = await res.json()
      setOriginalData(data)
      setFormData({
        nombre: data.nombre || "",
        cc: data.cc || "",
        foto_url: data.foto_url || "",
        cargo: data.cargo || "",
        area: data.area || "",
        tipo_trabajador: data.tipo_trabajador || "",
        salario_base: data.salario_base || "",
        jornada_fija_hhmm: data.jornada_fija_hhmm || "",
        rol: data.rol || "",
        password: "",
      })
    } catch (err) {
      setError(err.message)
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

  async function fetchDefaultSchedules() {
    try {
      const res = await fetch("/api/horarios")
      if (res.ok) {
        const data = await res.json()
        setDefaultSchedules(data)
      }
    } catch (error) {
      console.error("Error fetching default schedules:", error)
    }
  }

  async function fetchParameters() {
    try {
      const res = await fetch("/api/parametros")
      if (res.ok) {
        const data = await res.json()
        if (data.salario_minimo) {
          setMinWage(data.salario_minimo)
        }
      }
    } catch (error) {
      console.error("Error fetching parameters:", error)
    }
  }

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  function handleImageSelect(e) {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreviewUrl(URL.createObjectURL(selectedFile))
    }
  }

  function handleAreaChange(e) {
    const newArea = e.target.value
    let newSchedule = formData.jornada_fija_hhmm

    // Auto-fill schedule if available
    if (newArea && defaultSchedules) {
      const column = AREA_MAPPING[newArea]
      const areaSchedule = defaultSchedules[column]

      if (areaSchedule) {
        try {
          // Parse if it's a string, otherwise use as is
          newSchedule = typeof areaSchedule === 'string' ? JSON.parse(areaSchedule) : areaSchedule
        } catch (err) {
          console.error("Error parsing default schedule:", err)
        }
      }
    }

    setFormData((prev) => ({
      ...prev,
      area: newArea,
      jornada_fija_hhmm: newSchedule
    }))
  }

  function handleScheduleChange(newSchedule) {
    setFormData((prev) => ({ ...prev, jornada_fija_hhmm: newSchedule }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setSaving(true)

    try {
      let finalFotoUrl = formData.foto_url

      // Upload image if selected
      if (file) {
        setUploading(true)
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${formData.cc}/${fileName}`

        const uploadFormData = new FormData()
        uploadFormData.append("file", file)
        uploadFormData.append("path", filePath)

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: uploadFormData,
        })

        if (!uploadRes.ok) {
          const errorData = await uploadRes.json()
          throw new Error(errorData.message || "Error al subir imagen")
        }

        const { publicUrl } = await uploadRes.json()

        finalFotoUrl = publicUrl
        setUploading(false)
      }

      const updateData = { ...formData, foto_url: finalFotoUrl }
      // Si no se cambió la contraseña, no la enviamos
      if (!updateData.password) {
        delete updateData.password
      }

      // Asegurarse de que jornada_fija_hhmm se envíe como objeto JSON, no como string
      if (updateData.jornada_fija_hhmm && typeof updateData.jornada_fija_hhmm === 'string') {
        try {
          updateData.jornada_fija_hhmm = JSON.parse(updateData.jornada_fija_hhmm)
        } catch (e) {
          console.error("Error parsing schedule before save:", e)
        }
      }

      const res = await fetch(`/api/empleados/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || "Error al actualizar empleado")
      }

      router.push("/empleados")
    } catch (err) {
      setError(err.message)
      setUploading(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setError("")
    setDeleting(true)

    try {
      const res = await fetch(`/api/empleados/${params.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || "Error al eliminar empleado")
      }

      router.push("/empleados")
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  if (!canManageEmployees(user?.rol)) {
    return null
  }

  if (loading) {
    return <div className="text-center py-8">Cargando...</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Editar Empleado</h1>

      {originalData && (
        <div className="mb-4 text-sm text-muted-foreground">
          Usuario: <span className="font-semibold text-foreground">{originalData.username}</span>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center mb-6">
            <div className="flex flex-col items-center gap-2">
              <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border relative">
                {previewUrl || formData.foto_url ? (
                  <img src={previewUrl || formData.foto_url} alt="Foto de perfil" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-muted-foreground text-xs text-center px-2">Sin foto</span>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white text-xs">Subiendo...</span>
                  </div>
                )}
              </div>
              <label className="cursor-pointer bg-primary text-primary-foreground px-3 py-1 rounded-md text-xs font-medium hover:opacity-90 transition-opacity">
                Cambiar Foto
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div>
              <label htmlFor="cc" className="block text-sm font-medium text-foreground mb-1">
                Cédula
              </label>
              <input
                id="cc"
                name="cc"
                type="number"
                value={formData.cc}
                disabled
                className="w-full px-3 py-2 border border-input bg-muted text-muted-foreground rounded-md focus:outline-none cursor-not-allowed"
                title="La cédula no se puede editar"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="area" className="block text-sm font-medium text-foreground mb-1">
                Área
              </label>
              <select
                id="area"
                name="area"
                value={formData.area}
                onChange={handleAreaChange}
                disabled={isCoordinator(user?.rol)}
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">Seleccionar área</option>
                {Object.keys(AREA_MAPPING).map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
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
              <div className="flex gap-2">
                <input
                  id="salario_base"
                  name="salario_base"
                  type="number"
                  step="0.01"
                  value={formData.salario_base}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {minWage && (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, salario_base: minWage }))}
                    className="px-4 py-2 bg-slate-100 border border-slate-300 text-slate-700 rounded-md text-sm font-medium whitespace-nowrap hover:bg-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                    title={`Asignar salario mínimo: ${minWage}`}
                  >
                    Asignar Mínimo
                  </button>
                )}
              </div>
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

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
              Nueva contraseña (dejar vacío para mantener actual)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/empleados")}
              className="px-6 py-2 border border-border rounded-md hover:bg-accent transition-colors text-foreground font-medium"
            >
              Cancelar
            </button>
            {!isCoordinator(user?.rol) && (
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="px-6 py-2 bg-destructive text-white rounded-md hover:opacity-90 transition-opacity font-medium"
              >
                Eliminar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-foreground mb-4">Confirmar Eliminación</h2>
            <p className="text-muted-foreground mb-4">
              ¿Está seguro que desea eliminar a <strong>{originalData?.nombre || originalData?.username}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div className="mb-4">
              <label htmlFor="deletePassword" className="block text-sm font-medium text-foreground mb-1">
                Ingrese su contraseña para confirmar
              </label>
              <input
                id="deletePassword"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Contraseña"
              />
            </div>
            {error && <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm mb-4">{error}</div>}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletePassword("")
                  setError("")
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors text-foreground font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || !deletePassword}
                className="flex-1 px-4 py-2 bg-destructive text-white rounded-md hover:opacity-90 transition-opacity font-medium disabled:opacity-50"
              >
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
