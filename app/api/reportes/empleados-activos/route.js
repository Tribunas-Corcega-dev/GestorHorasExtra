
import { NextResponse } from "next/server"
import { canSeeAllEmployees } from "@/lib/permissions"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const inicio = searchParams.get("inicio")
    const fin = searchParams.get("fin")

    if (!inicio || !fin) {
        return NextResponse.json({ message: "Fechas requeridas" }, { status: 400 })
    }

    const user = await getUserFromRequest(request)
    if (!user || !canSeeAllEmployees(user.rol)) {
        return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    try {
        // Fetch specific columns to check for overtime
        const jornadas = await prisma.jornadas.findMany({
            where: {
                fecha: {
                    gte: new Date(`${inicio}T00:00:00.000Z`),
                    lte: new Date(`${fin}T23:59:59.999Z`),
                },
            },
            select: {
                empleado_id: true,
                horas_extra_hhmm: true,
            },
        })

        // Filter and get unique employee IDs
        const activeEmployeeIds = new Set()
        jornadas.forEach(j => {
            const h = j.horas_extra_hhmm || {}
            // Check if has relevant hours
            const hasHours = Object.values(h.breakdown || {}).some(v => v > 0) ||
                Object.values(h.breakdown?.overtime || {}).some(v => v > 0) ||
                Object.values(h.breakdown?.surcharges || {}).some(v => v > 0)

            if (hasHours) activeEmployeeIds.add(j.empleado_id)
        })

        return NextResponse.json(Array.from(activeEmployeeIds))
    } catch (error) {
        console.error("Error fetching active employees:", error)
        return NextResponse.json({ message: "Error interno" }, { status: 500 })
    }
}
