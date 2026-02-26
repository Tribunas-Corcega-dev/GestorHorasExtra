
import { NextResponse } from "next/server"
import { canManageOvertime } from "@/lib/permissions"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(request) {
    try {
        const user = await getUserFromRequest(request)
        if (!user) {
            return NextResponse.json({ message: "No autorizado" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const empleado_id = searchParams.get("empleado_id")

        if (!empleado_id) {
            return NextResponse.json({ message: "ID de empleado requerido" }, { status: 400 })
        }

        // Check verification: Self or Manager
        if (user.id !== empleado_id && !canManageOvertime(user.rol)) {
            return NextResponse.json({ message: "No tienes permiso para ver este resumen" }, { status: 403 })
        }

        const data = await prisma.resumen_horas_extra.findUnique({
            where: { usuario_id: empleado_id },
            select: { acumulado_hhmm: true, updated_at: true }
        })

        return NextResponse.json(data?.acumulado_hhmm || {})

    } catch (error) {
        console.error("Internal Error:", error)
        return NextResponse.json({ message: "Error interno" }, { status: 500 })
    }
}
