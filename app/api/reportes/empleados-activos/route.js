
import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"
import { canSeeAllEmployees } from "@/lib/permissions"
import jwt from "jsonwebtoken"

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
    const { searchParams } = new URL(request.url)
    const inicio = searchParams.get("inicio")
    const fin = searchParams.get("fin")

    if (!inicio || !fin) {
        return NextResponse.json({ message: "Fechas requeridas" }, { status: 400 })
    }

    const user = await getUserFromRequest(request)
    if (!user || !canSeeAllEmployees(user.rol)) {
        return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    try {
        // Fetch specific columns to check for overtime
        const { data: jornadas, error } = await supabase
            .from("jornadas")
            .select("empleado_id, horas_extra_hhmm")
            .gte("fecha", inicio)
            .lte("fecha", fin)

        if (error) throw error

        // Filter and get unique employee IDs
        const activeEmployeeIds = new Set()
        jornadas.forEach(j => {
            const h = j.horas_extra_hhmm || {}
            // Check if has relevant hours
            const hasHours = Object.values(h.breakdown || {}).some(v => v > 0) ||
                Object.values(h.breakdown?.overtime || {}).some(v => v > 0) ||
                Object.values(h.breakdown?.surcharges || {}).some(v => v > 0)

            if (hasHours) activeEmployeeIds.add(j.empleado_id)
        })

        return NextResponse.json(Array.from(activeEmployeeIds))
    } catch (error) {
        console.error("Error fetching active employees:", error)
        return NextResponse.json({ message: "Error interno" }, { status: 500 })
    }
}
