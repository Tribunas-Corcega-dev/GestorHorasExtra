
import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

async function getAuthState(request) {
    const user = await getUserFromRequest(request)
    if (!user) {
        return { user: null, error: "No autorizado" }
    }

    return { user, error: null }
}

export async function GET(request) {
    const { user, error } = await getAuthState(request)
    if (error || !user) return NextResponse.json({ message: error || "No autorizado" }, { status: 401 })

    // Return current signature
    return NextResponse.json({ firma: user.firma_digital })
}

export async function POST(request) {
    const { user, error: authError } = await getAuthState(request)
    if (authError || !user) return NextResponse.json({ message: authError || "No autorizado" }, { status: 401 })

    try {
        const body = await request.json()
        const { firma } = body

        if (!firma) return NextResponse.json({ message: "Firma requerida" }, { status: 400 })

        await prisma.usuarios.update({
            where: { id: user.id },
            data: { firma_digital: firma }
        })

        return NextResponse.json({ message: "Firma actualizada correctamente" })
    } catch (error) {
        console.error("Error saving signature:", error)
        return NextResponse.json({ message: "Error interno" }, { status: 500 })
    }
}
