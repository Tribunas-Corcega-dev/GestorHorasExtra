"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { ProtectedRoute } from "@/components/ProtectedRoute"

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <AppNavigator />
    </ProtectedRoute>
  )
}

function AppNavigator() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      const roleRoutes = {
        JEFE: "/dashboard/jefe",
        TALENTO_HUMANO: "/dashboard/talento-humano",
        ASISTENTE_GERENCIA: "/dashboard/asistente-gerencia",
        COORDINADOR: "/dashboard/coordinador",
        OPERARIO: "/dashboard/operario",
      }

      const targetRoute = roleRoutes[user.rol]

      if (targetRoute) {
        router.push(targetRoute)
      } else {
        // Fallback or error handling if role doesn't match
        console.error("Role not recognized:", user.rol)
      }
    }
  }, [user, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirigiendo a tu panel...</p>
      </div>
    </div>
  )
}
