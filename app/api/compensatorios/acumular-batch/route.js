import { NextResponse } from "next/server"
import { logAudit } from "@/lib/logger"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

function getValueFuzzy(obj, key) {
  if (!obj) return 0
  if (obj[key]) return Number(obj[key]) || 0

  const normalizedKey = key.toLowerCase().replace(/ /g, "_")
  const foundKey = Object.keys(obj).find((k) => k.toLowerCase().replace(/ /g, "_") === normalizedKey)
  return foundKey ? Number(obj[foundKey]) || 0 : 0
}

function normalizeRequestMap(requests) {
  const normalized = {}
  for (const [type, minutes] of Object.entries(requests || {})) {
    const value = parseInt(minutes, 10)
    if (!Number.isFinite(value) || value <= 0) continue
    normalized[type] = value
  }
  return normalized
}

export async function POST(request) {
  try {
    const currentUser = await getUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { requests, target_user_id } = body
    const normalizedRequests = normalizeRequestMap(requests)

    if (Object.keys(normalizedRequests).length === 0) {
      return NextResponse.json({ message: "No se enviaron datos para procesar" }, { status: 400 })
    }

    let targetUserId = currentUser.id

    if (target_user_id && target_user_id !== currentUser.id) {
      const allowedRoles = ["ADMIN", "COORDINADOR", "TALENTO_HUMANO", "GERENTE", "JEFE"]
      if (!allowedRoles.includes(currentUser.rol) && !currentUser.is_admin) {
        return NextResponse.json({ message: "No tienes permisos para realizar esta acción para otro usuario." }, { status: 403 })
      }
      targetUserId = target_user_id
    }

    let finalBalance = null

    const totalProcessedMinutes = await prisma.$transaction(
      async (tx) => {
        const targetUser = await tx.usuarios.findUnique({
          where: { id: targetUserId },
          select: { id: true, bolsa_horas_minutos: true },
        })

        if (!targetUser) {
          throw new Error("TARGET_USER_NOT_FOUND")
        }

        const jornadas = await tx.jornadas.findMany({
          where: { empleado_id: targetUser.id },
          orderBy: { fecha: "asc" },
          select: {
            id: true,
            horas_extra_hhmm: true,
            desglose_compensacion: true,
          },
        })

        let total = 0
        const updates = {}

        for (const [type, requestedMinutes] of Object.entries(normalizedRequests)) {
          let remainingToBank = requestedMinutes
          if (remainingToBank <= 0) continue

          for (const jornada of jornadas) {
            if (remainingToBank <= 0) break

            const breakdown =
              jornada.horas_extra_hhmm?.breakdown ||
              jornada.horas_extra_hhmm?.flatBreakdown ||
              jornada.horas_extra_hhmm?.breakdown_legacy ||
              {}

            let availableTotal = 0
            if (breakdown.overtime) availableTotal = getValueFuzzy(breakdown.overtime, type)
            if (availableTotal === 0 && breakdown.surcharges) availableTotal = getValueFuzzy(breakdown.surcharges, type)
            if (availableTotal === 0) availableTotal = getValueFuzzy(breakdown, type)
            if (!availableTotal || availableTotal <= 0) continue

            const currentDesglose = { ...(jornada.desglose_compensacion || {}), ...(updates[jornada.id]?.desglose_compensacion || {}) }
            const alreadyBanked = Number(currentDesglose[type]) || 0
            const availableForBanking = availableTotal - alreadyBanked
            if (availableForBanking <= 0) continue

            const take = Math.min(remainingToBank, availableForBanking)
            currentDesglose[type] = alreadyBanked + take
            total += take

            const newTotalBanked = Object.values(currentDesglose).reduce((a, b) => a + (Number(b) || 0), 0)

            updates[jornada.id] = {
              id: jornada.id,
              desglose_compensacion: currentDesglose,
              horas_para_bolsa_minutos: newTotalBanked,
              estado_compensacion: "APROBADO",
            }

            remainingToBank -= take
          }
        }

        if (total > 0) {
          for (const update of Object.values(updates)) {
            await tx.jornadas.update({
              where: { id: update.id },
              data: {
                desglose_compensacion: update.desglose_compensacion,
                horas_para_bolsa_minutos: update.horas_para_bolsa_minutos,
                estado_compensacion: update.estado_compensacion,
              },
            })
          }

          const currentBalance = targetUser.bolsa_horas_minutos || 0
          finalBalance = currentBalance + total

          await tx.usuarios.update({
            where: { id: targetUser.id },
            data: { bolsa_horas_minutos: finalBalance },
          })

          await tx.historial_bolsa.create({
            data: {
              usuario_id: targetUser.id,
              tipo_movimiento: "ACUMULACION",
              minutos: total,
              saldo_resultante: finalBalance,
              observacion: "Acumulación automática desde historial",
              realizado_por: currentUser.id,
            },
          })
        }

        return total
      },
      { isolationLevel: "Serializable" }
    )

    if (totalProcessedMinutes > 0) {
      await logAudit({
        action: "ACUMULAR_BOLSA",
        entity: "BOLSA_HORAS",
        entityId: targetUserId,
        details: {
          minutos_acumulados: totalProcessedMinutes,
          saldo_resultante: finalBalance,
          solicitado_por: currentUser.username,
        },
        user: currentUser,
      })
    }

    return NextResponse.json({
      message: "Solicitud procesada y aprobada correctamente",
      accumulated: totalProcessedMinutes,
    })
  } catch (error) {
    if (error?.message === "TARGET_USER_NOT_FOUND") {
      return NextResponse.json({ message: "Usuario destino no encontrado" }, { status: 404 })
    }

    console.error("Error batch banking:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
