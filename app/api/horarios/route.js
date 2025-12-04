import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabaseClient"
import { canManageOvertime } from "@/lib/permissions"
import { calculateScheduleSurcharges } from "@/lib/calculations"

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

        // Fetch the single record (assuming singleton)
        const { data, error } = await supabase
            .from("horarios_base")
            .select("*")
            .limit(1)
            .single()

        if (error && error.code !== 'PGRST116') {
            console.error("Error fetching horarios:", error)
            return NextResponse.json({ message: "Error al obtener horarios" }, { status: 500 })
        }

        return NextResponse.json(data || {})
    } catch (error) {
        console.error("Error in GET horarios:", error)
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
        const { areaColumn, schedule, id } = body

        if (!areaColumn || !schedule) {
            return NextResponse.json({ message: "Faltan datos requeridos" }, { status: 400 })
        }

        // Validate allowed columns to prevent SQL injection or bad updates
        const allowedColumns = [
            "h_acueducto",
            "h_alcantarillado",
            "h_aseo",
            "h_op_bocatoma",
            "h_admin",
            "h_planta_tratamiento",
            "h_planta_nocturna"
        ]

        if (!allowedColumns.includes(areaColumn)) {
            return NextResponse.json({ message: "Área no válida" }, { status: 400 })
        }

        // Fetch Night Shift Parameters
        let nightShiftRange = { start: "21:00", end: "06:00" } // Default
        const { data: params } = await supabase.from("parametros").select("jornada_nocturna").single()
        if (params && params.jornada_nocturna) {
            nightShiftRange = params.jornada_nocturna
        }

        // Calculate Surcharges for the schedule
        const enrichedSchedule = calculateScheduleSurcharges(schedule, nightShiftRange)

        let result
        if (id) {
            // Update existing
            result = await supabase
                .from("horarios_base")
                .update({ [areaColumn]: enrichedSchedule })
                .eq("id", id)
                .select()
                .single()
        } else {
            // Insert new (check if exists first)
            const { data: existing } = await supabase.from("horarios_base").select("id").limit(1).single()

            if (existing) {
                result = await supabase
                    .from("horarios_base")
                    .update({ [areaColumn]: enrichedSchedule })
                    .eq("id", existing.id)
                    .select()
                    .single()
            } else {
                result = await supabase
                    .from("horarios_base")
                    .insert([{ [areaColumn]: enrichedSchedule }])
                    .select()
                    .single()
            }
        }

        if (result.error) {
            console.error("Error saving horario:", result.error)
            return NextResponse.json({ message: "Error al guardar horario" }, { status: 500 })
        }

        return NextResponse.json(result.data)
    } catch (error) {
        console.error("Error in POST horarios:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
