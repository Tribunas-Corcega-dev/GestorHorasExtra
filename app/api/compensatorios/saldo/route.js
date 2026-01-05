import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabaseClient"

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

        // Fetch history
        const { data: history, error: historyError } = await supabase
            .from("historial_bolsa")
            .select("*")
            .eq("usuario_id", user.id)
            .order("fecha", { ascending: false })

        if (historyError) {
            console.error("Error fetching bank history:", historyError)
        }

        return NextResponse.json({
            saldo_minutos: user.bolsa_horas_minutos || 0,
            historial: history || [],
            jornada_fija_hhmm: user.jornada_fija_hhmm,
            rol: user.rol
        })

    } catch (error) {
        console.error("Error in GET saldo:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
