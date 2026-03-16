import { NextResponse } from "next/server"
import { canManageOvertime } from "@/lib/permissions"
import { logAudit } from "@/lib/logger"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"
import { normalizeOvertimeType } from "@/lib/calculations"

const CANONICAL_LABELS = {
    extra_diurna: "Trabajo extra diurno",
    extra_nocturna: "Trabajo extra nocturno",
    extra_diurna_festivo: "Trabajo extra diurno dominical y festivo",
    extra_nocturna_festivo: "Trabajo extra nocturno en domingos y festivos",
    recargo_nocturno: "Trabajo nocturno",
    dominical_festivo: "Trabajo dominical y festivo",
    recargo_nocturno_festivo: "Trabajo nocturno en dominical y festivo",
}

function inferNormalizedType(item) {
    const rawType = String(item?.tipo_hora_extra || "")
    let normalized = normalizeOvertimeType(rawType)
    const recargo = Number(item?.recargo)

    // Ambiguous data fix: if a row is labeled as "trabajo extra nocturno"
    // but carries a small surcharge-like value, treat it as recargo_nocturno.
    if (normalized === "extra_nocturna" && /trabajo\s+extra\s+nocturno/i.test(rawType) && Number.isFinite(recargo) && recargo <= 50) {
        normalized = "recargo_nocturno"
    }

    return normalized
}

function toCanonicalLabel(item) {
    const normalized = inferNormalizedType(item)
    return CANONICAL_LABELS[normalized] || item.tipo_hora_extra
}

export async function GET(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const data = await prisma.recargos_he.findMany({
            orderBy: { id: "asc" }
        })

        return NextResponse.json(
            (data || []).map((item) => ({
                ...item,
                id: Number(item.id),
                tipo_hora_extra: toCanonicalLabel(item),
            }))
        )
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

        const recargoNumber = Number(recargo)
        if (!Number.isFinite(recargoNumber) || recargoNumber < 0) {
            return NextResponse.json({ message: "Recargo invalido" }, { status: 400 })
        }

        const data = await prisma.recargos_he.update({
            where: { id: BigInt(id) },
            data: { tipo_hora_extra, recargo: recargoNumber }
        })

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
