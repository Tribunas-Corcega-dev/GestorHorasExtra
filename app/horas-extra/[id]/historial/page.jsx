"use client"

import { useParams } from "next/navigation"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { OvertimeHistoryView } from "@/app/horas-extra/components/OvertimeHistoryView"

export default function HistorialHorasExtraPage() {
    const params = useParams()

    return (
        <ProtectedRoute>
            <Layout>
                <OvertimeHistoryView employeeId={params.id} />
            </Layout>
        </ProtectedRoute>
    )
}
