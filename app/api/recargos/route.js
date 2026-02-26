import { NextResponse } from "next/server"
import { canManageOvertime } from "@/lib/permissions"
import { logAudit } from "@/lib/logger"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const data = await prisma.recargos_he.findMany({
            orderBy: { id: "asc" }
        })

        return NextResponse.json((data || []).map((item) => ({ ...item, id: Number(item.id) })))
    } catch (error) {
        console.error("Error in GET recargos:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}

export async function PUT(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user || !canManageOvertime(user.rol)) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const body = await request.json()
        const { id, tipo_hora_extra, recargo } = body

        if (!id || !tipo_hora_extra || recargo === undefined) {
            return NextResponse.json({ message: "Faltan datos requeridos" }, { status: 400 })
        }

        const data = await prisma.recargos_he.update({
            where: { id: BigInt(id) },
            data: { tipo_hora_extra, recargo: Number(recargo) }
        })

        // Audit Log
        await logAudit({
            action: "UPDATE",
            entity: "CONFIGURACION",
            entityId: id,
            details: {
                target: "RECARGO",
                tipo_hora_extra: tipo_hora_extra,
                nuevo_recargo: recargo
            },
            user: user
        })

        return NextResponse.json({ ...data, id: Number(data.id) })
    } catch (error) {
        console.error("Error in PUT recargos:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
