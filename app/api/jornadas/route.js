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

export async function POST(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user || !canManageOvertime(user.rol)) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const body = await request.json()
        const { empleado_id, fecha, jornada_base_calcular } = body

        if (!empleado_id || !fecha || !jornada_base_calcular) {
            return NextResponse.json({ message: "Faltan datos requeridos" }, { status: 400 })
        }

        // Insertar nueva jornada
        const { data: newJornada, error } = await supabase
            .from("jornadas")
            .insert([
                {
                    empleado_id,
                    fecha,
                    jornada_base_calcular,
                    horas_extra_hhmm: {}, // Inicializar vacío como solicitado
                },
            ])
            .select()
            .single()

        if (error) {
            console.error("[v0] Error creating jornada:", error)
            return NextResponse.json({ message: `Error al registrar jornada: ${error.message}` }, { status: 500 })
        }

        return NextResponse.json(newJornada, { status: 201 })
    } catch (error) {
        console.error("[v0] Error in POST jornadas:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}

export async function GET(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user || !canManageOvertime(user.rol)) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const empleado_id = searchParams.get("empleado_id")

        let query = supabase
            .from("jornadas")
            .select("*")
            .order("fecha", { ascending: false })

        if (empleado_id) {
            query = query.eq("empleado_id", empleado_id)
        }

        const { data: jornadas, error } = await query

        if (error) {
            console.error("[v0] Error fetching jornadas:", error)
            return NextResponse.json({ message: `Error al obtener jornadas: ${error.message}` }, { status: 500 })
        }

        return NextResponse.json(jornadas)
    } catch (error) {
        console.error("[v0] Error in GET jornadas:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
