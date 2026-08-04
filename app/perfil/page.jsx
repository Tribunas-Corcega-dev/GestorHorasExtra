"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"

export default function PerfilPage() {
  return (
    <Layout>
      <CambiarPasswordContent />
    </Layout>
  )
}

function CambiarPasswordContent() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (newPassword !== confirmPassword) {
      setError("La nueva contraseña y la confirmación no coinciden")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || "No se pudo actualizar la contraseña")
        return
      }

      setSuccess("Contraseña actualizada correctamente")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err) {
      setError("Error de conexión, intenta de nuevo")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-foreground">Mi Perfil</h1>
      <p className="text-muted-foreground mb-8">
        {user?.username} · {user?.rol}
      </p>

      <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">Cambiar contraseña</h2>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-md bg-green-50 text-green-700 text-sm border border-green-200">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Contraseña actual
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Nueva contraseña
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">Mínimo 8 caracteres</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Confirmar nueva contraseña
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Actualizar contraseña"}
          </button>
        </form>
      </div>
    </div>
  )
}
