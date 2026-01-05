"use client"

import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { EmployeeDetailsView } from "@/app/empleados/components/EmployeeDetailsView"
import { CompensatoryTimeWidget } from "@/app/dashboard/components/CompensatoryTimeWidget"

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

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-foreground">Mi Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Widget Column */}
                <div className="md:col-span-1">
                    <CompensatoryTimeWidget />
                </div>

                {/* Details Column - Full width on mobile, 2/3 on desktop */}
                <div className="md:col-span-2">
                    <EmployeeDetailsView employeeId={user?.id} showBackButton={false} />
                </div>
            </div>
        </div>
    )
}
