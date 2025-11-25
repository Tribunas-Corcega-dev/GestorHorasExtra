"use client"

import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import Link from "next/link"

export default function RecargosPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-4 mb-6">
                        <Link href="/ajustes" className="text-muted-foreground hover:text-foreground">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </Link>
                        <h1 className="text-3xl font-bold text-foreground">Recargos Horas Extra</h1>
                    </div>

                    <div className="bg-card border border-border rounded-lg p-12 text-center">
                        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold mb-2">Próximamente</h2>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            Esta funcionalidad está en desarrollo. Aquí podrás configurar los porcentajes de recargo para los diferentes tipos de horas extra.
                        </p>
                    </div>
                </div>
            </Layout>
        </ProtectedRoute>
    )
}
