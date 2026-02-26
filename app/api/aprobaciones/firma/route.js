
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request) {
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
        const body = await request.json()
        const { empleado_id, jefe_id, periodo_inicio, periodo_fin, firma_snapshot } = body

        // Upsert approval
        // Check if exists first to avoid dupes or usage Upsert on unique constraint if I had one (I didn't add unique constraint in SQL script but logic should handle)

        // Better: Delete existing for this period/employee then insert, or just insert if not exists.
        // Let's usage upsert based on ID if we had it, but here we define uniqueness by (employee, period).

        // Let's delete previous approval for this period to be safe (re-approval)
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
                jefe_id,
                periodo_inicio: new Date(periodo_inicio),
                periodo_fin: new Date(periodo_fin),
                firma_snapshot,
                estado: 'APROBADO'
            }
        })

        return NextResponse.json(data)
    } catch (error) {
        console.error("Error saving approval:", error)
        return NextResponse.json({ message: "Error al guardar aprobación" }, { status: 500 })
    }
}
