import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { canManageEmployees } from "@/lib/permissions"
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
    try {
        const user = await getUserFromRequest(request)

        // Only HR and Admin (JEFE) can view audit logs
        if (!user || (user.rol !== "JEFE" && user.rol !== "TALENTO_HUMANO")) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "50")
        const entity = searchParams.get("entity") || ""
        const action = searchParams.get("action") || ""
        const startDate = searchParams.get("startDate") || ""
        const endDate = searchParams.get("endDate") || ""

        const offset = (page - 1) * limit

        let query = supabaseAdmin
            .from("audit_logs")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1)

        if (entity) query = query.eq("entity", entity)
        if (action) query = query.eq("action", action)
        if (startDate) query = query.gte("created_at", startDate)
        if (endDate) query = query.lte("created_at", endDate)

        const { data: logs, count, error } = await query

        if (error) {
            console.error("[Audit API] Error fetching logs:", error)
            return NextResponse.json({ message: "Error al obtener logs" }, { status: 500 })
        }

        // Fetch user directory for resolving IDs in frontend
        const { data: users } = await supabaseAdmin
            .from("usuarios")
            .select("id, nombre, username")

        const userDirectory = {}
        users?.forEach(u => {
            userDirectory[u.id] = u.nombre || u.username
        })

        return NextResponse.json({
            logs,
            total: count,
            page,
            totalPages: Math.ceil(count / limit),
            userDirectory
        })
    } catch (error) {
        console.error("[Audit API] Exception:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
