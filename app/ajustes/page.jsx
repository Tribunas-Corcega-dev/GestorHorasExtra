"use client"

import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageOvertime } from "@/lib/permissions"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect } from "react"

export default function AjustesPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <AjustesContent />
            </Layout>
        </ProtectedRoute>
    )
}

function AjustesContent() {
    const { user } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (user && !canManageOvertime(user.rol)) {
            router.push("/dashboard")
        }
    }, [user, router])

    if (!canManageOvertime(user?.rol)) {
        return null
    }

    const menuItems = [
        {
            title: "Recargos Horas Extra por ley",
            description: "Configura los porcentajes de recargo para horas extra diurnas, nocturnas y festivas.",
            href: "/ajustes/recargos",
            icon: (
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        {
            title: "Horarios preestablecidos para áreas",
            description: "Define horarios de trabajo estándar para diferentes áreas de la empresa.",
            href: "/ajustes/horarios",
            icon: (
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        {
            title: "Salario mínimo preestablecido",
            description: "Actualiza el valor del salario mínimo legal vigente para cálculos de nómina.",
            href: "/ajustes/salario",
            icon: (
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            )
        }
    ]

    return (
        <div className="max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold mb-2 text-foreground">Ajustes</h1>
            <p className="text-muted-foreground mb-8">Configuración general del sistema de horas extra.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {menuItems.map((item, index) => (
                    <Link
                        key={index}
                        href={item.href}
                        className="bg-card border border-border rounded-lg p-6 shadow-sm hover:shadow-md transition-all hover:border-primary/50 group"
                    >
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                            {item.icon}
                        </div>
                        <h3 className="font-semibold text-lg text-foreground mb-2 group-hover:text-primary transition-colors">
                            {item.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {item.description}
                        </p>
                    </Link>
                ))}
            </div>
        </div>
    )
}
