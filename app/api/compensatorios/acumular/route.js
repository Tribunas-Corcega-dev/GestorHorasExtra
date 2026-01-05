import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabaseClient"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

async function getUserFromRequest(request) {
    const token = request.cookies.get("auth_token")?.value
    if (!token) return null

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        // Use admin to ensure we get user even if RLS is tricky (though usually users can see themselves)
        const client = supabaseAdmin || supabase
        const { data: user } = await client.from("usuarios").select("*").eq("id", decoded.id).single()
        return user
    } catch {
        return null
    }
}

export async function POST(request) {
    try {
        if (!supabaseAdmin) {
            console.error("SUPABASE_SERVICE_ROLE_KEY is missing")
            return NextResponse.json({ message: "Error de configuración del servidor" }, { status: 500 })
        }

        const user = await getUserFromRequest(request)

        if (!user) {
            return NextResponse.json({ message: "No autorizado" }, { status: 401 })
        }

        const body = await request.json()
        const { jornada_id, minutos } = body

        if (!jornada_id || !minutos || minutos <= 0) {
            return NextResponse.json({ message: "Datos inválidos" }, { status: 400 })
        }

        // 1. Verify Jornada belongs to user and is open
        const { data: jornada, error: jornadaError } = await supabaseAdmin
            .from("jornadas")
            .select("id, empleado_id, estado_compensacion")
            .eq("id", jornada_id)
            .single()

        if (jornadaError || !jornada) {
            return NextResponse.json({ message: `Jornada no encontrada (ID: ${jornada_id})` }, { status: 404 })
        }

        if (jornada.empleado_id !== user.id) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        if (jornada.estado_compensacion !== 'NINGUNO' && jornada.estado_compensacion !== 'RECHAZADO') {
            return NextResponse.json({ message: "Ya existe una solicitud para esta jornada" }, { status: 400 })
        }

        // 2. Update Jornada to 'SOLICITADO'
        const { error: updateError } = await supabaseAdmin
            .from("jornadas")
            .update({
                horas_para_bolsa_minutos: minutos,
                estado_compensacion: 'SOLICITADO'
            })
            .eq("id", jornada_id)

        if (updateError) {
            console.error("Error updating jornada:", updateError)
            return NextResponse.json({ message: "Error al crear la solicitud" }, { status: 500 })
        }

        // 3. Optional: Create Audit Log (Initial Request)
        await supabase.from("historial_bolsa").insert({
            usuario_id: user.id,
            tipo_movimiento: 'AJUSTE', // Or a new type 'SOLICITUD' if we added it, but let's use AJUSTE for now or just log the intent.
            // Actually, we process the balance change only on APPROVAL.
            // So we might skip inserting into historial_bolsa here, or add a 'SOLICITUD' entry with 0 minutes affecting balance.
            // Let's keep it simple: History tracks BALANCE changes. So no entry yet.
            minutos: 0,
            saldo_resultante: user.bolsa_horas_minutos || 0,
            referencia_id: jornada_id,
            observacion: `Solicitud de acumulación por ${minutos} minutos`,
            realizado_por: user.id
        })

        return NextResponse.json({ message: "Solicitud enviada correctamente" })

    } catch (error) {
        console.error("Error in POST acumular:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
