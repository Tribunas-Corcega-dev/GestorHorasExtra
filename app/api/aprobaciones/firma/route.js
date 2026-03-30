import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserFromRequest } from "@/lib/apiAuth"
import { canManageOvertime, canApproveOvertimeApproval } from "@/lib/permissions"

export async function GET(request) {
    const user = await getUserFromRequest(request)
    if (!user || !canManageOvertime(user.rol)) {
        return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const periodo_inicio = searchParams.get("inicio")
    const periodo_fin = searchParams.get("fin")

    if (!periodo_inicio || !periodo_fin) {
        return NextResponse.json({ message: "Fechas requeridas" }, { status: 400 })
    }

    const data = await prisma.aprobaciones_periodo.findMany({
        where: {
            periodo_inicio: new Date(periodo_inicio),
            periodo_fin: new Date(periodo_fin),
        }
    })

    return NextResponse.json(data)
}

export async function POST(request) {
    try {
        const user = await getUserFromRequest(request)
        if (!user || !canApproveOvertimeApproval(user.rol)) {
            return NextResponse.json({ message: "Solo el perfil JEFE puede aprobar este formato" }, { status: 403 })
        }

        const body = await request.json()
        const { empleado_id, periodo_inicio, periodo_fin, firma_snapshot } = body

        await prisma.aprobaciones_periodo.deleteMany({
            where: {
                empleado_id,
                periodo_inicio: new Date(periodo_inicio),
                periodo_fin: new Date(periodo_fin),
            }
        })

        const data = await prisma.aprobaciones_periodo.create({
            data: {
                empleado_id,
                jefe_id: user.id,
                periodo_inicio: new Date(periodo_inicio),
                periodo_fin: new Date(periodo_fin),
                firma_snapshot,
                estado: "APROBADO"
            }
        })

        return NextResponse.json(data)
    } catch (error) {
        console.error("Error saving approval:", error)
        return NextResponse.json({ message: "Error al guardar aprobacion" }, { status: 500 })
    }
}
