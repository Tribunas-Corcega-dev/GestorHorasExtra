"use client"

import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageEmployees, isWorker, isCoordinator } from "@/lib/permissions"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { EmpleadosManager } from "./components/EmpleadosManager"
import { EmpleadosCoordinador } from "./components/EmpleadosCoordinador"

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

  useEffect(() => {
    if (user && isWorker(user.rol)) {
      router.push("/dashboard")
    }
  }, [user, router])

  if (!canManageEmployees(user?.rol)) {
    return null
  }

  if (isCoordinator(user?.rol)) {
    return <EmpleadosCoordinador />
  }

  return <EmpleadosManager />
}
