"use client"

import { Layout } from "@/components/Layout"
import Link from "next/link"

export default function FirmaSettingsPage() {
    return (
        <Layout>
            <div className="max-w-3xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Firma Digital Deshabilitada</h1>
                    <p className="text-muted-foreground">Este modulo fue retirado. El proceso ahora es por impresion y firma fisica.</p>
                </div>

                <div className="bg-card border border-border rounded-lg p-6 shadow-sm space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Para aprobar formatos, use la vista de formato e imprima el documento para firma manual.
                    </p>
                    <Link
                        href="/ajustes"
                        className="inline-flex px-4 py-2 border border-input rounded-md hover:bg-accent"
                    >
                        Volver a Ajustes
                    </Link>
                </div>
            </div>
        </Layout>
    )
}
