"use client"

import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { EmployeeDetailsView } from "@/app/empleados/components/EmployeeDetailsView"

export default function OperarioDashboard() {
    return (
        <ProtectedRoute allowedRoles={["OPERARIO"]}>
            <Layout>
                <OperarioContent />
            </Layout>
        </ProtectedRoute>
    )
}

function OperarioContent() {
    const { user } = useAuth()

    return <EmployeeDetailsView employeeId={user?.id} showBackButton={false} />
}
