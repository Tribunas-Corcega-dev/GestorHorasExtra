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
        const targetUserId = searchParams.get("userId")
        const includePending = searchParams.get("includePending") !== "false"

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
            const tUser = await prisma.usuarios.findUnique({ where: { id: targetId } })
            if (!tUser) {
                return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
            }
            targetUser = tUser
        }

        const pendingMinutes = includePending
            ? (await prisma.solicitudes_tiempo.findMany({
                where: { usuario_id: targetId, estado: "PENDIENTE" },
                select: { minutos_solicitados: true }
            })).reduce((sum, req) => sum + (req.minutos_solicitados || 0), 0)
            : 0
        const totalMinutes = targetUser.bolsa_horas_minutos || 0
        const availableMinutes = totalMinutes - pendingMinutes

        // Operario is now read-only: do not expose request subsystem list in self-view.
        const shouldExposeRequests = !(user.rol === "OPERARIO" && targetId === user.id)
        const requestHistory = shouldExposeRequests
            ? await prisma.solicitudes_tiempo.findMany({
                where: { usuario_id: targetId },
                orderBy: { fecha_inicio: "desc" }
            })
            : []

        // Fetch history (Balance Log)
        const history = await prisma.historial_bolsa.findMany({
            where: { usuario_id: targetId },
            orderBy: { fecha: "desc" }
        })

        return NextResponse.json({
            saldo_total: totalMinutes,
            saldo_pendiente: pendingMinutes,
            saldo_disponible: availableMinutes,
            historial: history.map(item => ({
                id: item.id,
                fecha: item.fecha,
                tipo_operacion: item.tipo_movimiento,
                unidad: "minutos",
                cantidad_minutos: item.minutos,
                saldo_nuevo: item.saldo_resultante,
                descripcion: item.observacion || "Movimiento de compensaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n en tiempo"
            })),
            solicitudes: shouldExposeRequests ? requestHistory : [],
            jornada_fija_hhmm: targetUser.jornada_fija_hhmm,
            rol: targetUser.rol
        })

    } catch (error) {
        console.error("Error in GET saldo:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}