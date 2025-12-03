"use client"

import { ProtectedRoute } from "@/components/ProtectedRoute"
import { Layout } from "@/components/Layout"
import { AppealDetailsView } from "../components/AppealDetailsView"
import { useParams } from "next/navigation"

export default function AppealDetailsPage() {
    const params = useParams()

    return (
        <ProtectedRoute>
            <Layout>
                <AppealDetailsView appealId={params?.id} />
            </Layout>
        </ProtectedRoute>
    )
}
