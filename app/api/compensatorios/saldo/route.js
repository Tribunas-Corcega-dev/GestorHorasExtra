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

import { canManageOvertime } from "@/lib/permissions"

export async function GET(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user) {
            return NextResponse.json({ message: "No autorizado" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const targetUserId = searchParams.get("userId")

        let targetId = user.id

        if (targetUserId) {
            if (!canManageOvertime(user.rol)) {
                return NextResponse.json({ message: "No tienes permisos para ver el saldo de otros usuarios" }, { status: 403 })
            }
            targetId = targetUserId
        }

        // Fetch target user data (needed if targetId != user.id)
        let targetUser = user
        if (targetId !== user.id) {
            const { data: tUser, error: tUserError } = await supabase.from("usuarios").select("*").eq("id", targetId).single()
            if (tUserError || !tUser) {
                return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
            }
            targetUser = tUser
        }

        // Fetch pending requests
        const { data: pendingRequests } = await supabase
            .from("solicitudes_tiempo")
            .select("minutos_solicitados")
            .eq("usuario_id", targetId)
            .eq("estado", "PENDIENTE")

        const pendingMinutes = pendingRequests?.reduce((sum, req) => sum + req.minutos_solicitados, 0) || 0
        const totalMinutes = targetUser.bolsa_horas_minutos || 0
        const availableMinutes = totalMinutes - pendingMinutes

        // Fetch full request history
        const { data: requestHistory } = await supabase
            .from("solicitudes_tiempo")
            .select("*")
            .eq("usuario_id", targetId)
            .order("fecha_inicio", { ascending: false })

        // Fetch history (Balance Log)
        const { data: history, error: historyError } = await supabase
            .from("historial_bolsa")
            .select("*")
            .eq("usuario_id", targetId)
            .order("fecha", { ascending: false })

        if (historyError) {
            console.error("Error fetching bank history:", historyError)
        }

        return NextResponse.json({
            saldo_total: totalMinutes,
            saldo_pendiente: pendingMinutes,
            saldo_disponible: availableMinutes,
            historial: (history || []).map(item => ({
                id: item.id,
                fecha: item.fecha,
                tipo_operacion: item.tipo_movimiento,
                unidad: 'minutos', // Adding default unit
                cantidad_minutos: item.minutos,
                saldo_nuevo: item.saldo_resultante,
                descripcion: item.observacion || "Movimiento de bolsa"
            })),
            solicitudes: requestHistory || [],
            jornada_fija_hhmm: targetUser.jornada_fija_hhmm,
            rol: targetUser.rol
        })

    } catch (error) {
        console.error("Error in GET saldo:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
