"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Layout } from "@/components/Layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { SignatureCanvas } from "@/components/SignatureCanvas"
import { useRouter } from "next/navigation"

export default function FirmaSettingsPage() {
    return (
        <ProtectedRoute>
            <Layout>
                <FirmaSettingsContent />
            </Layout>
        </ProtectedRoute>
    )
}

function FirmaSettingsContent() {
    const { user } = useAuth()
    const router = useRouter()
    const [signature, setSignature] = useState(null)
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)

    // Redirect if not JEFE or similar (optional, but good UX)
    // Actually letting others sign allows future flexibility

    useEffect(() => {
        if (user) {
            fetchSignature()
        }
    }, [user])

    const fetchSignature = async () => {
        try {
            const res = await fetch("/api/usuarios/firma")
            if (res.ok) {
                const data = await res.json()
                if (data.firma) setSignature(data.firma)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!signature) return
        setSaving(true)
        try {
            const res = await fetch("/api/usuarios/firma", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ firma: signature })
            })

            if (res.ok) {
                alert("Firma guardada correctamente")
                router.push("/ajustes")
            } else {
                throw new Error("Error al guardar")
            }
        } catch (error) {
            alert("Error al guardar la firma")
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div>Cargando...</div>

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Configurar Firma Digital</h1>
                <p className="text-muted-foreground">Esta firma se utilizará para aprobar los formatos de horas extra.</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 shadow-sm space-y-6">

                {signature && (
                    <div className="p-4 bg-muted/20 rounded-lg border border-border">
                        <label className="block text-sm font-medium mb-2">Firma Actual Guardada:</label>
                        <img src={signature} alt="Firma Actual" className="h-24 object-contain border bg-white rounded" />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium mb-2">Nueva Firma (Dibuje en el recuadro):</label>
                    <SignatureCanvas
                        width={600}
                        height={200}
                        onEnd={(data) => setSignature(data)}
                    />
                </div>

                <div className="pt-4 flex gap-4">
                    <button
                        onClick={handleSave}
                        disabled={saving || !signature}
                        className="bg-primary text-primary-foreground px-6 py-2 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                        {saving ? "Guardando..." : "Guardar Firma"}
                    </button>
                    <button
                        onClick={() => router.back()}
                        className="px-6 py-2 border border-input rounded-md hover:bg-accent"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    )
}
