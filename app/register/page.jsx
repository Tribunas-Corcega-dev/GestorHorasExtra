"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"

export default function RegisterPage() {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [nombre, setNombre] = useState("")
    const [rol, setRol] = useState("OPERARIO")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const { register } = useAuth()
    const router = useRouter()

    async function handleSubmit(e) {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            await register({ username, password, nombre, rol })
            router.push("/login")
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="w-full max-w-md">
                <div className="bg-card border border-border rounded-lg shadow-lg p-8">
                    <h1 className="text-2xl font-bold text-center mb-6 text-foreground">Registrarse</h1>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="nombre" className="block text-sm font-medium text-foreground mb-1">
                                Nombre Completo
                            </label>
                            <input
                                id="nombre"
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Tu nombre completo"
                            />
                        </div>

                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
                                Usuario
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Elige un nombre de usuario"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                                Contraseña
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Elige una contraseña"
                            />
                        </div>

                        <div>
                            <label htmlFor="rol" className="block text-sm font-medium text-foreground mb-1">
                                Rol
                            </label>
                            <select
                                id="rol"
                                value={rol}
                                onChange={(e) => setRol(e.target.value)}
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="OPERARIO">Operario</option>
                                <option value="COORDINADOR">Coordinador</option>
                                <option value="JEFE">Jefe</option>
                                <option value="TALENTO_HUMANO">Talento Humano</option>
                                <option value="ASISTENTE_GERENCIA">Asistente de Gerencia</option>
                            </select>
                        </div>

                        {error && <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 font-medium"
                        >
                            {loading ? "Registrando..." : "Registrarse"}
                        </button>
                    </form>

                    <div className="mt-4 text-center text-sm">
                        <span className="text-muted-foreground">¿Ya tienes cuenta? </span>
                        <Link href="/login" className="text-primary hover:underline font-medium">
                            Inicia sesión
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
