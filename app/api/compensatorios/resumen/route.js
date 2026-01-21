
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
            return NextResponse.json({ message: "No autorizado" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const empleado_id = searchParams.get("empleado_id")

        if (!empleado_id) {
            return NextResponse.json({ message: "ID de empleado requerido" }, { status: 400 })
        }

        // Check verification: Self or Manager
        if (user.id !== empleado_id && !canManageOvertime(user.rol)) {
            return NextResponse.json({ message: "No tienes permiso para ver este resumen" }, { status: 403 })
        }

        const { data, error } = await supabase
            .from("resumen_horas_extra")
            .select("acumulado_hhmm, updated_at")
            .eq("usuario_id", empleado_id)
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found" (which means 0 balance)
            console.error("Error fetching summary:", error)
            return NextResponse.json({ message: "Error obteniendo resumen" }, { status: 500 })
        }

        return NextResponse.json(data?.acumulado_hhmm || {})

    } catch (error) {
        console.error("Internal Error:", error)
        return NextResponse.json({ message: "Error interno" }, { status: 500 })
    }
}
