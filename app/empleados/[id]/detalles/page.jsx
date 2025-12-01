"use client"

import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageEmployees, isCoordinator } from "@/lib/permissions"
import { useRouter, useParams } from "next/navigation"
import { useEffect } from "react"
import { EmployeeDetailsView } from "@/app/empleados/components/EmployeeDetailsView"

export default function DetalleEmpleadoPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <DetalleEmpleadoContent />
            </Layout>
        </ProtectedRoute>
    )
}

function DetalleEmpleadoContent() {
    const params = useParams()
    const { user } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (user && !canManageEmployees(user.rol) && !isCoordinator(user.rol)) {
            router.push("/dashboard")
        }
    }, [user, router])

    return <EmployeeDetailsView employeeId={params?.id} />
}
