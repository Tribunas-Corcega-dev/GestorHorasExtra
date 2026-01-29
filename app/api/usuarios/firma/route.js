
import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabaseClient"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

async function getUserFromRequest(request) {
    const token = request.cookies.get("auth_token")?.value
    if (!token) return { error: "No token provided" }

    if (!supabaseAdmin) {
        return { error: "Server Configuration Error: Supabase Admin not initialized" }
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        // Use admin to bypass RLS need for self-update if policies tricky
        const { data: user, error } = await supabaseAdmin.from("usuarios").select("*").eq("id", decoded.id).single()

        if (error) {
            console.error("Supabase Admin Error:", error)
            return { error: `DB Error: ${error.message} (${error.code})` }
        }

        return { user }
    } catch (e) {
        console.error("Auth Error:", e)
        return { error: "Token Verification Failed" }
    }
}

export async function GET(request) {
    const { user, error } = await getUserFromRequest(request)
    if (error || !user) return NextResponse.json({ message: error || "No autorizado" }, { status: 401 })

    // Return current signature
    return NextResponse.json({ firma: user.firma_digital })
}

export async function POST(request) {
    const { user, error: authError } = await getUserFromRequest(request)
    if (authError || !user) return NextResponse.json({ message: authError || "No autorizado" }, { status: 401 })

    try {
        const body = await request.json()
        const { firma } = body

        if (!firma) return NextResponse.json({ message: "Firma requerida" }, { status: 400 })

        const { error } = await supabaseAdmin
            .from("usuarios")
            .update({ firma_digital: firma })
            .eq("id", user.id)

        if (error) throw error

        return NextResponse.json({ message: "Firma actualizada correctamente" })
    } catch (error) {
        console.error("Error saving signature:", error)
        return NextResponse.json({ message: "Error interno" }, { status: 500 })
    }
}
