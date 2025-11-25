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

        if (!user || !canManageOvertime(user.rol)) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        // Fetch the single parameters record (assuming only one exists or we want the latest)
        const { data, error } = await supabase
            .from("parametros")
            .select("*")
            .limit(1)
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 is "The result contains 0 rows"
            console.error("Error fetching parameters:", error)
            return NextResponse.json({ message: "Error al obtener parámetros" }, { status: 500 })
        }

        return NextResponse.json(data || {}) // Return empty object if no record found
    } catch (error) {
        console.error("Error in GET parametros:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}

export async function POST(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user || !canManageOvertime(user.rol)) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const body = await request.json()
        const { salario_minimo, anio_vigencia, id } = body

        if (!salario_minimo || !anio_vigencia) {
            return NextResponse.json({ message: "Faltan datos requeridos" }, { status: 400 })
        }

        let result
        if (id) {
            // Update existing
            result = await supabase
                .from("parametros")
                .update({ salario_minimo, anio_vigencia })
                .eq("id", id)
                .select()
                .single()
        } else {
            // Insert new (check if one exists first to avoid duplicates if we want singleton)
            const { data: existing } = await supabase.from("parametros").select("id").limit(1).single()

            if (existing) {
                result = await supabase
                    .from("parametros")
                    .update({ salario_minimo, anio_vigencia })
                    .eq("id", existing.id)
                    .select()
                    .single()
            } else {
                result = await supabase
                    .from("parametros")
                    .insert([{ salario_minimo, anio_vigencia }])
                    .select()
                    .single()
            }
        }

        if (result.error) {
            console.error("Error saving parameters:", result.error)
            return NextResponse.json({ message: "Error al guardar parámetros" }, { status: 500 })
        }

        return NextResponse.json(result.data)
    } catch (error) {
        console.error("Error in POST parametros:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
