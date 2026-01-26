"use client"

import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageEmployees, isWorker } from "@/lib/permissions"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { EmpleadosManager } from "@/app/empleados/components/EmpleadosManager"

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

    useEffect(() => {
        if (user && isWorker(user.rol)) {
            router.push("/dashboard")
        }
    }, [user, router])

    if (!canManageEmployees(user?.rol)) {
        return null
    }

    // Reuse the Unified EmpleadosManager component
    return <EmpleadosManager />
}
