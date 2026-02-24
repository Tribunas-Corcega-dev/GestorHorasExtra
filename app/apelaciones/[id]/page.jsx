"use client"


import { Layout } from "@/components/Layout"
import { AppealDetailsView } from "../components/AppealDetailsView"
import { useParams } from "next/navigation"

export default function AppealDetailsPage() {
    const params = useParams()

    return (
        
            <Layout>
                <AppealDetailsView appealId={params?.id} />
            </Layout>
        
    )
}
