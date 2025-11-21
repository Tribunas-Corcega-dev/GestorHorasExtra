"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login")
      } else if (allowedRoles && !allowedRoles.includes(user.rol)) {
        router.push("/dashboard")
      }
    }
  }, [user, loading, router, allowedRoles])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Cargando...</div>
      </div>
    )
  }

  if (!user || (allowedRoles && !allowedRoles.includes(user.rol))) {
    return null
  }

  return children
}
