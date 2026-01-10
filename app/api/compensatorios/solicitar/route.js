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

        if (!user) {
            return NextResponse.json({ message: "No autorizado" }, { status: 401 })
        }

        const body = await request.json()
        const { fecha_inicio, fecha_fin, minutos_solicitados, tipo, motivo, targetUserId } = body

        if (!fecha_inicio || !fecha_fin || !minutos_solicitados || minutos_solicitados <= 0 || !tipo) {
            return NextResponse.json({ message: "Datos incompletos o inválidos" }, { status: 400 })
        }

        // Determine target user and permissions
        let targetId = user.id
        let autoApprove = false

        if (targetUserId) {
            if (!canManageOvertime(user.rol)) {
                return NextResponse.json({ message: "No tienes permisos para gestionar otros usuarios" }, { status: 403 })
            }
            targetId = targetUserId
            autoApprove = true
        } else {
            // Basic user cannot approve their own request
            autoApprove = false
        }

        // Fetch target user if different
        let targetUser = user
        if (targetId !== user.id) {
            const { data: tUser } = await supabase.from("usuarios").select("*").eq("id", targetId).single()
            if (!tUser) return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
            targetUser = tUser
        }

        // 0. Check for duplicate requests on the same date
        const dateOnly = fecha_inicio.split('T')[0]
        const dayStart = `${dateOnly}T00:00:00`
        const dayEnd = `${dateOnly}T23:59:59`

        const { data: duplicateRequests } = await supabase
            .from("solicitudes_tiempo")
            .select("id")
            .eq("usuario_id", targetId)
            .neq("estado", "RECHAZADA")
            .gte("fecha_inicio", dayStart)
            .lte("fecha_inicio", dayEnd)

        if (duplicateRequests && duplicateRequests.length > 0) {
            return NextResponse.json({ message: "Ya existe una solicitud activa para esta fecha." }, { status: 400 })
        }

        // 1. Check Balance
        const currentBalance = targetUser.bolsa_horas_minutos || 0

        // Count pending requests to avoid "double spending"
        const { data: pendingRequests } = await supabase
            .from("solicitudes_tiempo")
            .select("minutos_solicitados")
            .eq("usuario_id", targetId)
            .eq("estado", "PENDIENTE")

        const pendingMinutes = pendingRequests?.reduce((sum, req) => sum + req.minutos_solicitados, 0) || 0
        const availableBalance = currentBalance - pendingMinutes

        if (minutos_solicitados > availableBalance) {
            return NextResponse.json({
                message: `Saldo insuficiente. El usuario tiene ${currentBalance} min, menos ${pendingMinutes} pendientes = ${availableBalance} disponibles.`
            }, { status: 400 })
        }

        // 2. Create Request
        const requestStatus = autoApprove ? 'APROBADO' : 'PENDIENTE'
        const approvalData = autoApprove ? {
            aprobado_por: user.id,
            fecha_aprobacion: new Date().toISOString()
        } : {}

        const { data: newRequest, error: insertError } = await supabase
            .from("solicitudes_tiempo")
            .insert({
                usuario_id: targetId,
                fecha_inicio,
                fecha_fin,
                minutos_solicitados,
                tipo,
                motivo: autoApprove ? (motivo || "Canjeo directo por coordinador") : motivo,
                estado: requestStatus,
                ...approvalData
            })
            .select() // Select to get ID if needed
            .single()

        if (insertError) {
            console.error("Error creating request:", insertError)
            return NextResponse.json({ message: "Error al crear la solicitud" }, { status: 500 })
        }

        // 3. If Auto-Approve, Deduct Balance Immediately
        if (autoApprove) {
            const newBalance = currentBalance - minutos_solicitados

            // Update user balance
            const { error: updateError } = await supabase
                .from("usuarios")
                .update({ bolsa_horas_minutos: newBalance })
                .eq("id", targetId)

            if (updateError) {
                console.error("Error updating balance:", updateError)
                // Rollback (delete request) ideally, but for now log error
                return NextResponse.json({ message: "Error al actualizar saldo" }, { status: 500 })
            }

            // Create History Log
            await supabase.from("historial_bolsa").insert({
                usuario_id: targetId,
                tipo_operacion: 'REDENCION',
                cantidad_minutos: -minutos_solicitados,
                saldo_anterior: currentBalance,
                saldo_nuevo: newBalance,
                descripcion: `Canjeo directo por ${user.nombre || user.username}`,
                entidad_referencia: 'solicitudes_tiempo',
                referencia_id: newRequest.id
            })
        }

        return NextResponse.json({ message: autoApprove ? "Tiempo canjeado exitosamente" : "Solicitud creada exitosamente" })

    } catch (error) {
        console.error("Error in POST solicitar:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
