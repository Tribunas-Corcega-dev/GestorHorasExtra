"use client"

import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { canManageOvertime, isCoordinator } from "@/lib/permissions"
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

    // Vista específica para Coordinadores
    if (isCoordinator(user.rol)) {
        return (
            <div className="max-w-5xl mx-auto">
                <h1 className="text-3xl font-bold mb-2 text-foreground">Ajustes de Coordinador</h1>
                <p className="text-muted-foreground mb-8">Configuración de su área.</p>

                <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
                    <p>No hay ajustes disponibles por el momento.</p>
                </div>
            </div>
        )
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
            title: "Parámetros Generales",
            description: "Actualiza el salario mínimo y límites de la bolsa de horas.",
            href: "/ajustes/salario",
            icon: (
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            )
        },
        {
            title: "Firma Digital",
            description: "Configure su firma digital para la aprobación de documentos.",
            href: "/ajustes/firma",
            icon: (
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
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
