"use client"

import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"

export default function OperarioDashboard() {
    return (
        <ProtectedRoute allowedRoles={["OPERARIO"]}>
            <Layout>
                <OperarioContent />
            </Layout>
        </ProtectedRoute>
    )
}

function OperarioContent() {
    const { user } = useAuth()

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-foreground">Mi Perfil</h1>
            <div className="bg-card border border-border rounded-lg shadow-md p-6 space-y-4">
                <div>
                    <p className="text-sm text-muted-foreground">Usuario</p>
                    <p className="text-lg font-semibold text-foreground">{user.username}</p>
                </div>
                {user.nombre && (
                    <div>
                        <p className="text-sm text-muted-foreground">Nombre</p>
                        <p className="text-lg font-semibold text-foreground">{user.nombre}</p>
                    </div>
                )}
                {user.area && (
                    <div>
                        <p className="text-sm text-muted-foreground">Área</p>
                        <p className="text-lg font-semibold text-foreground">{user.area}</p>
                    </div>
                )}
                <div>
                    <p className="text-sm text-muted-foreground">Rol</p>
                    <p className="text-lg font-semibold text-foreground">{user.rol}</p>
                </div>
            </div>
        </div>
    )
}
