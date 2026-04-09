"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Layout } from "@/components/Layout"
import { BalanceManagementPage } from "@/app/horas-extra/components/BalanceManagementModal"
import { useAuth } from "@/hooks/useAuth"
import { canManageOvertime } from "@/lib/permissions"

export default function GestionCompensacionPage() {
    const params = useParams()
    const router = useRouter()
    const { user, loading } = useAuth()

    useEffect(() => {
        if (!loading && user && !canManageOvertime(user.rol)) {
            router.push("/dashboard")
        }
    }, [loading, user, router])

    if (!loading && user && !canManageOvertime(user.rol)) return null

    return (
        <Layout>
            <BalanceManagementPage employeeId={params.id} />
        </Layout>
    )
}