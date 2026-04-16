import { NextResponse } from "next/server"
import { canManageOvertime } from "@/lib/permissions"
import { logAudit } from "@/lib/logger"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

function parseDateTime(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    if (user.rol === "OPERARIO") {
      return NextResponse.json({ message: "Este perfil es solo de consulta para compensacion en tiempo" }, { status: 403 })
    }

    const body = await request.json()
    const { fecha_inicio, fecha_fin, minutos_solicitados, tipo, motivo, targetUserId } = body

    if (!fecha_inicio || !fecha_fin || !minutos_solicitados || minutos_solicitados <= 0 || !tipo) {
      return NextResponse.json({ message: "Datos incompletos o inválidos" }, { status: 400 })
    }

    const fechaInicio = parseDateTime(fecha_inicio)
    const fechaFin = parseDateTime(fecha_fin)
    if (!fechaInicio || !fechaFin) {
      return NextResponse.json({ message: "Fechas inválidas" }, { status: 400 })
    }

    let targetId = user.id
    let autoApprove = false

    if (targetUserId) {
      if (!canManageOvertime(user.rol)) {
        return NextResponse.json({ message: "No tienes permisos para gestionar otros usuarios" }, { status: 403 })
      }
      targetId = targetUserId
      autoApprove = true
    }

    let targetUser = user
    if (targetId !== user.id) {
      const tUser = await prisma.usuarios.findUnique({ where: { id: targetId } })
      if (!tUser) {
        return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
      }
      targetUser = tUser
    }

    const dateOnly = fecha_inicio.split("T")[0]
    const dayStart = new Date(`${dateOnly}T00:00:00.000Z`)
    const dayEnd = new Date(`${dateOnly}T23:59:59.999Z`)

    const duplicateCount = await prisma.solicitudes_tiempo.count({
      where: {
        usuario_id: targetId,
        estado: { not: "RECHAZADO" },
        fecha_inicio: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    })

    if (duplicateCount > 0) {
      return NextResponse.json({ message: "Ya existe una solicitud activa para esta fecha." }, { status: 400 })
    }

    const pendingAgg = await prisma.solicitudes_tiempo.aggregate({
      _sum: { minutos_solicitados: true },
      where: {
        usuario_id: targetId,
        estado: "PENDIENTE",
      },
    })

    const currentBalance = targetUser.bolsa_horas_minutos || 0
    const pendingMinutes = pendingAgg._sum.minutos_solicitados || 0
    const availableBalance = currentBalance - pendingMinutes

    if (minutos_solicitados > availableBalance) {
      return NextResponse.json(
        {
          message: `Saldo insuficiente. El usuario tiene ${currentBalance} min, menos ${pendingMinutes} pendientes = ${availableBalance} disponibles.`,
        },
        { status: 400 }
      )
    }

    const requestStatus = autoApprove ? "APROBADO" : "PENDIENTE"
    const requestMotivo = autoApprove ? motivo || "Canjeo directo por coordinador" : motivo

    let newBalance = currentBalance
    let createdRequestId = null

    if (autoApprove) {
      const txResult = await prisma.$transaction(
        async (tx) => {
          const latestTarget = await tx.usuarios.findUnique({
            where: { id: targetId },
            select: { bolsa_horas_minutos: true },
          })

          if (!latestTarget) {
            throw new Error("TARGET_USER_NOT_FOUND")
          }

          const latestPendingAgg = await tx.solicitudes_tiempo.aggregate({
            _sum: { minutos_solicitados: true },
            where: {
              usuario_id: targetId,
              estado: "PENDIENTE",
            },
          })

          const latestBalance = latestTarget.bolsa_horas_minutos || 0
          const latestPending = latestPendingAgg._sum.minutos_solicitados || 0
          const latestAvailable = latestBalance - latestPending

          if (minutos_solicitados > latestAvailable) {
            throw new Error("INSUFFICIENT_BALANCE")
          }

          const newRequest = await tx.solicitudes_tiempo.create({
            data: {
              usuario_id: targetId,
              fecha_inicio: fechaInicio,
              fecha_fin: fechaFin,
              minutos_solicitados,
              tipo,
              motivo: requestMotivo,
              estado: requestStatus,
              aprobado_por: user.id,
              fecha_aprobacion: new Date(),
            },
            select: { id: true },
          })

          const updatedBalance = latestBalance - minutos_solicitados

          await tx.usuarios.update({
            where: { id: targetId },
            data: { bolsa_horas_minutos: updatedBalance },
          })

          await tx.historial_bolsa.create({
            data: {
              usuario_id: targetId,
              tipo_movimiento: "USO",
              minutos: minutos_solicitados,
              saldo_resultante: updatedBalance,
              observacion: `Canjeo directo por ${user.nombre || user.username}`,
              referencia_id: newRequest.id,
              realizado_por: user.id,
            },
          })

          return { requestId: newRequest.id, balance: updatedBalance }
        },
        { isolationLevel: "Serializable" }
      )

      createdRequestId = txResult.requestId
      newBalance = txResult.balance
    } else {
      const newRequest = await prisma.solicitudes_tiempo.create({
        data: {
          usuario_id: targetId,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          minutos_solicitados,
          tipo,
          motivo: requestMotivo,
          estado: requestStatus,
        },
        select: { id: true },
      })

      createdRequestId = newRequest.id
    }

    if (autoApprove) {
      await logAudit({
        action: "REDENCION",
        entity: "BOLSA_HORAS",
        entityId: targetId,
        details: {
          minutos_redimidos: minutos_solicitados,
          saldo_resultante: newBalance,
          solicitado_por: user.username,
          motivo,
          tipo,
          solicitud_id: createdRequestId,
        },
        user,
      })
    }

    return NextResponse.json({ message: autoApprove ? "Tiempo canjeado exitosamente" : "Solicitud creada exitosamente" })
  } catch (error) {
    if (error?.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ message: "Saldo insuficiente" }, { status: 400 })
    }

    if (error?.message === "TARGET_USER_NOT_FOUND") {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
    }

    console.error("Error in POST solicitar:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

