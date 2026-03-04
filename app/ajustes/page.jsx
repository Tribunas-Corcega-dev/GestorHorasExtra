"use client"

import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"

import { canManageOvertime, isCoordinator } from "@/lib/permissions"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect } from "react"

export default function AjustesPage() {
    return (
        
            <Layout>
                <AjustesContent />
            </Layout>
        
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

    // Vista específica para Coordinadores - Se permite acceso pero limitado
    const isCoord = isCoordinator(user.rol)

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
            description: "Actualiza el salario mínimo y los límites de compensación en tiempo.",
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
        },
        {
            title: "Auditoría de Cambios",
            description: "Registro detallado de cambios realizados en el sistema (empleados, ajustes, etc).",
            href: "/ajustes/auditoria",
            icon: (
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            )
        }
    ]

    const visibleItems = isCoord
        ? menuItems.filter(item => item.href !== "/ajustes/salario")
        : menuItems

    return (
        <div className="max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold mb-2 text-foreground">Ajustes</h1>
            <p className="text-muted-foreground mb-8">Configuración del sistema.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleItems.map((item, index) => (
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
