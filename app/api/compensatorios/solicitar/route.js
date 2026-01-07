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

export async function POST(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user) {
            return NextResponse.json({ message: "No autorizado" }, { status: 401 })
        }

        const body = await request.json()
        const { fecha_inicio, fecha_fin, minutos_solicitados, tipo, motivo } = body

        if (!fecha_inicio || !fecha_fin || !minutos_solicitados || minutos_solicitados <= 0 || !tipo) {
            return NextResponse.json({ message: "Datos incompletos o inválidos" }, { status: 400 })
        }

        // 0. Check for duplicate requests on the same date
        const dateOnly = fecha_inicio.split('T')[0]
        const dayStart = `${dateOnly}T00:00:00`
        const dayEnd = `${dateOnly}T23:59:59`

        const { data: duplicateRequests } = await supabase
            .from("solicitudes_tiempo")
            .select("id")
            .eq("usuario_id", user.id)
            .neq("estado", "RECHAZADA")
            .gte("fecha_inicio", dayStart)
            .lte("fecha_inicio", dayEnd)

        if (duplicateRequests && duplicateRequests.length > 0) {
            return NextResponse.json({ message: "Ya existe una solicitud activa para esta fecha." }, { status: 400 })
        }

        // 1. Check Balance
        const currentBalance = user.bolsa_horas_minutos || 0

        // Count pending requests to avoid "double spending"
        const { data: pendingRequests } = await supabase
            .from("solicitudes_tiempo")
            .select("minutos_solicitados")
            .eq("usuario_id", user.id)
            .eq("estado", "PENDIENTE")

        const pendingMinutes = pendingRequests?.reduce((sum, req) => sum + req.minutos_solicitados, 0) || 0
        const availableBalance = currentBalance - pendingMinutes

        if (minutos_solicitados > availableBalance) {
            return NextResponse.json({
                message: `Saldo insuficiente. Tienes ${currentBalance} min, menos ${pendingMinutes} pendientes = ${availableBalance} disponibles.`
            }, { status: 400 })
        }

        // 2. Create Request
        const { error: insertError } = await supabase
            .from("solicitudes_tiempo")
            .insert({
                usuario_id: user.id,
                fecha_inicio,
                fecha_fin,
                minutos_solicitados,
                tipo,
                motivo,
                estado: 'PENDIENTE'
            })

        if (insertError) {
            console.error("Error creating request:", insertError)
            return NextResponse.json({ message: "Error al crear la solicitud" }, { status: 500 })
        }

        return NextResponse.json({ message: "Solicitud de tiempo creada exitosamente" })

    } catch (error) {
        console.error("Error in POST solicitar:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
