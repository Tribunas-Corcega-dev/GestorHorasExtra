import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabaseClient"
import { canManageOvertime } from "@/lib/permissions"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

async function getUserFromRequest(request) {
    const token = request.cookies.get("auth_token")?.value
    if (!token) return null

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        const { data: user } = await supabase.from("usuarios").select("*").eq("id", decoded.id).single()
        return user
    } catch {
        return null
    }
}

export async function GET(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const { data, error } = await supabase
            .from("recargos_he")
            .select("*")
            .order("id", { ascending: true })

        if (error) {
            console.error("Error fetching recargos:", error)
            return NextResponse.json({ message: "Error al obtener recargos" }, { status: 500 })
        }

        return NextResponse.json(data || [])
    } catch (error) {
        console.error("Error in GET recargos:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}

export async function PUT(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user || !canManageOvertime(user.rol)) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const body = await request.json()
        const { id, tipo_hora_extra, recargo } = body

        if (!id || !tipo_hora_extra || recargo === undefined) {
            return NextResponse.json({ message: "Faltan datos requeridos" }, { status: 400 })
        }

        const { data, error } = await supabase
            .from("recargos_he")
            .update({ tipo_hora_extra, recargo })
            .eq("id", id)
            .select()
            .single()

        if (error) {
            console.error("Error updating recargo:", error)
            return NextResponse.json({ message: "Error al actualizar recargo" }, { status: 500 })
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error("Error in PUT recargos:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
