"use client"

import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"

import { canManageEmployees, isWorker, isCoordinator } from "@/lib/permissions"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { EmpleadosManager } from "./components/EmpleadosManager"
import { EmpleadosCoordinador } from "./components/EmpleadosCoordinador"

export default function EmpleadosPage() {
  return (
    
      <Layout>
        <EmpleadosContent />
      </Layout>
    
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

  /* Combined View for all Managers and Coordinators */
  return <EmpleadosManager />
}
