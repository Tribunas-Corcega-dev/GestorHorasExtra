import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabaseClient"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { canManageOvertime } from "@/lib/permissions"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

async function getUserFromRequest(request) {
    const token = request.cookies.get("auth_token")?.value
    if (!token) return null

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        // Ensure we get user even if RLS blocks standard query
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
            return NextResponse.json({ message: "Servidor mal configurado (Falta Service Key)" }, { status: 500 })
        }

        const user = await getUserFromRequest(request)

        if (!user || !canManageOvertime(user.rol)) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const body = await request.json()
        const { type, id, action } = body
        // type: 'BANKING' | 'REDEMPTION'
        // action: 'APROBAR' | 'RECHAZAR'

        if (!type || !id || !action) {
            return NextResponse.json({ message: "Datos incompletos" }, { status: 400 })
        }

        if (type === 'BANKING') {
            // Get Jornada
            const { data: jornada, error: jError } = await supabaseAdmin
                .from("jornadas")
                .select("*")
                .eq("id", id)
                .single()

            if (jError || !jornada) return NextResponse.json({ message: "Jornada no encontrada" }, { status: 404 })

            const minutos = jornada.horas_para_bolsa_minutos || 0
            if (minutos <= 0) return NextResponse.json({ message: "No hay horas para acumular" }, { status: 400 })

            if (action === 'APROBAR') {
                // Update Jornada
                const { error: uError } = await supabaseAdmin
                    .from("jornadas")
                    .update({ estado_compensacion: 'APROBADO', aprobado_por: user.id })
                    .eq("id", id)

                if (uError) throw uError

                // Get Current Balance
                const { data: userData } = await supabaseAdmin.from("usuarios").select("bolsa_horas_minutos").eq("id", jornada.empleado_id).single()
                const newBalance = (userData.bolsa_horas_minutos || 0) + minutos

                // Update Balance
                await supabaseAdmin.from("usuarios").update({ bolsa_horas_minutos: newBalance }).eq("id", jornada.empleado_id)

                // Add History
                await supabaseAdmin.from("historial_bolsa").insert({
                    usuario_id: jornada.empleado_id,
                    tipo_movimiento: 'ACUMULACION',
                    minutos: minutos,
                    saldo_resultante: newBalance,
                    referencia_id: id,
                    observacion: 'Aprobación de horas extra a bolsa',
                    realizado_por: user.id
                })

            } else { // REJECT
                await supabaseAdmin
                    .from("jornadas")
                    .update({ estado_compensacion: 'RECHAZADO', aprobado_por: user.id }) // aprobado_por acts as "decided_by"
                    .eq("id", id)
            }

        } else if (type === 'REDEMPTION') {
            // Get Request
            const { data: req, error: rError } = await supabaseAdmin
                .from("solicitudes_tiempo")
                .select("*")
                .eq("id", id)
                .single()

            if (rError || !req) return NextResponse.json({ message: "Solicitud no encontrada" }, { status: 404 })

            const minutos = req.minutos_solicitados || 0

            if (action === 'APROBAR') {
                // Check Balance
                const { data: userData } = await supabaseAdmin.from("usuarios").select("bolsa_horas_minutos").eq("id", req.usuario_id).single()
                const currentBalance = userData.bolsa_horas_minutos || 0

                if (currentBalance < minutos) {
                    return NextResponse.json({ message: "Saldo insuficiente" }, { status: 400 })
                }

                const newBalance = currentBalance - minutos

                // Update Balance
                await supabaseAdmin.from("usuarios").update({ bolsa_horas_minutos: newBalance }).eq("id", req.usuario_id)

                // Update Request
                await supabaseAdmin
                    .from("solicitudes_tiempo")
                    .update({ estado: 'APROBADO', aprobado_por: user.id })
                    .eq("id", id)

                // Add History
                await supabaseAdmin.from("historial_bolsa").insert({
                    usuario_id: req.usuario_id,
                    tipo_movimiento: 'USO',
                    minutos: minutos,
                    saldo_resultante: newBalance,
                    referencia_id: id,
                    observacion: 'Uso de tiempo compensatorio aprobado',
                    realizado_por: user.id
                })

            } else { // REJECT
                await supabaseAdmin
                    .from("solicitudes_tiempo")
                    .update({ estado: 'RECHAZADO', aprobado_por: user.id })
                    .eq("id", id)
            }
        }

        return NextResponse.json({ message: "Operación exitosa" })

    } catch (error) {
        console.error("Error in POST gestionar:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}

export async function GET(request) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ message: "Servidor mal configurado" }, { status: 500 })
        }

        const user = await getUserFromRequest(request)
        if (!user || !canManageOvertime(user.rol)) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        // 1. Banking Requests (Jornadas)
        // Using explicit join on empleado_id
        const { data: bankingData, error: bankingError } = await supabaseAdmin
            .from("jornadas")
            .select("*, usuario:usuarios!empleado_id(nombre, username)")
            .eq("estado_compensacion", "SOLICITADO")
            .order("fecha", { ascending: true })

        if (bankingError) throw bankingError

        // 2. Redemption Requests (Solicitudes)
        // Using explicit join on usuario_id
        const { data: redemptionData, error: redemptionError } = await supabaseAdmin
            .from("solicitudes_tiempo")
            .select("*, usuario:usuarios!usuario_id(nombre, username)")
            .eq("estado", "PENDIENTE")
            .order("fecha_inicio", { ascending: true })

        if (redemptionError) throw redemptionError

        return NextResponse.json({
            banking: bankingData || [],
            redemption: redemptionData || []
        })

    } catch (error) {
        console.error("Error fetching approvals:", error)
        return NextResponse.json({ message: "Error al cargar solicitudes" }, { status: 500 })
    }
}
