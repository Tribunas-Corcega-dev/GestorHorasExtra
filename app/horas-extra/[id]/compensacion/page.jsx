"use client"

import { useParams } from "next/navigation"
import { Layout } from "@/components/Layout"
import { BalanceManagementPage } from "@/app/horas-extra/components/BalanceManagementModal"

export default function GestionCompensacionPage() {
    const params = useParams()

    return (
        <Layout>
            <BalanceManagementPage employeeId={params.id} />
        </Layout>
    )
}