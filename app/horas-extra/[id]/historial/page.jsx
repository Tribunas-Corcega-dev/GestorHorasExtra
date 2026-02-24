"use client"

import { useParams } from "next/navigation"
import { Layout } from "@/components/Layout"

import { OvertimeHistoryView } from "@/app/horas-extra/components/OvertimeHistoryView"

export default function HistorialHorasExtraPage() {
    const params = useParams()

    return (
        
            <Layout>
                <OvertimeHistoryView employeeId={params.id} />
            </Layout>
        
    )
}
