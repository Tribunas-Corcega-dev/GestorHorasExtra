"use client"

import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import Link from "next/link"

export default function SalarioPage() {
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
                        <h1 className="text-3xl font-bold text-foreground">Salario Mínimo</h1>
                    </div>

                    <div className="bg-card border border-border rounded-lg p-12 text-center">
                        <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold mb-2">Próximamente</h2>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            Esta funcionalidad está en desarrollo. Aquí podrás actualizar el valor del salario mínimo para que los cálculos de costos sean precisos.
                        </p>
                    </div>
                </div>
            </Layout>
        </ProtectedRoute>
    )
}
