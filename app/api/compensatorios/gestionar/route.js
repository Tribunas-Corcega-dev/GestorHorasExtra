import { NextResponse } from "next/server"
import { canManageOvertime } from "@/lib/permissions"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

function serializeDate(value) {
  if (!value) return value
  return new Date(value).toISOString()
}

function withUsuario(item, relationKey) {
  const usuario = item?.[relationKey]
  return {
    ...item,
    fecha: item?.fecha ? serializeDate(item.fecha) : item?.fecha,
    fecha_inicio: item?.fecha_inicio ? serializeDate(item.fecha_inicio) : item?.fecha_inicio,
    fecha_fin: item?.fecha_fin ? serializeDate(item.fecha_fin) : item?.fecha_fin,
    usuario: usuario
      ? {
          nombre: usuario.nombre,
          username: usuario.username,
        }
      : null,
    [relationKey]: undefined,
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request)

    if (!user || !canManageOvertime(user.rol)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const body = await request.json()
    const { type, id, action } = body

    if (!type || !id || !action) {
      return NextResponse.json({ message: "Datos incompletos" }, { status: 400 })
    }

    if (type === "BANKING") {
      const jornada = await prisma.jornadas.findUnique({ where: { id } })
      if (!jornada) {
        return NextResponse.json({ message: "Jornada no encontrada" }, { status: 404 })
      }

      const minutos = jornada.horas_para_bolsa_minutos || 0
      if (minutos <= 0) {
        return NextResponse.json({ message: "No hay horas para acumular" }, { status: 400 })
      }

      if (action === "APROBAR") {
        await prisma.$transaction(
          async (tx) => {
            await tx.jornadas.update({
              where: { id },
              data: { estado_compensacion: "APROBADO", aprobado_por: user.id },
            })

            const userData = await tx.usuarios.findUnique({
              where: { id: jornada.empleado_id },
              select: { bolsa_horas_minutos: true },
            })

            const currentBalance = userData?.bolsa_horas_minutos || 0
            const newBalance = currentBalance + minutos

            await tx.usuarios.update({
              where: { id: jornada.empleado_id },
              data: { bolsa_horas_minutos: newBalance },
            })

            await tx.historial_bolsa.create({
              data: {
                usuario_id: jornada.empleado_id,
                tipo_movimiento: "ACUMULACION",
                minutos,
                saldo_resultante: newBalance,
                referencia_id: id,
                observacion: "Aprobación de horas extra a bolsa",
                realizado_por: user.id,
              },
            })
          },
          { isolationLevel: "Serializable" }
        )
      } else {
        await prisma.jornadas.update({
          where: { id },
          data: { estado_compensacion: "RECHAZADO", aprobado_por: user.id },
        })
      }
    } else if (type === "REDEMPTION") {
      const req = await prisma.solicitudes_tiempo.findUnique({ where: { id } })
      if (!req) {
        return NextResponse.json({ message: "Solicitud no encontrada" }, { status: 404 })
      }

      const minutos = req.minutos_solicitados || 0

      if (action === "APROBAR") {
        try {
          await prisma.$transaction(
            async (tx) => {
              const userData = await tx.usuarios.findUnique({
                where: { id: req.usuario_id },
                select: { bolsa_horas_minutos: true },
              })

              const currentBalance = userData?.bolsa_horas_minutos || 0
              if (currentBalance < minutos) {
                throw new Error("INSUFFICIENT_BALANCE")
              }

              const newBalance = currentBalance - minutos

              await tx.usuarios.update({
                where: { id: req.usuario_id },
                data: { bolsa_horas_minutos: newBalance },
              })

              await tx.solicitudes_tiempo.update({
                where: { id },
                data: { estado: "APROBADO", aprobado_por: user.id, fecha_aprobacion: new Date() },
              })

              await tx.historial_bolsa.create({
                data: {
                  usuario_id: req.usuario_id,
                  tipo_movimiento: "USO",
                  minutos,
                  saldo_resultante: newBalance,
                  referencia_id: id,
                  observacion: "Uso de tiempo compensatorio aprobado",
                  realizado_por: user.id,
                },
              })
            },
            { isolationLevel: "Serializable" }
          )
        } catch (error) {
          if (error?.message === "INSUFFICIENT_BALANCE") {
            return NextResponse.json({ message: "Saldo insuficiente" }, { status: 400 })
          }
          throw error
        }
      } else {
        await prisma.solicitudes_tiempo.update({
          where: { id },
          data: { estado: "RECHAZADO", aprobado_por: user.id, fecha_aprobacion: new Date() },
        })
      }
    } else {
      return NextResponse.json({ message: "Tipo de operación inválido" }, { status: 400 })
    }

    return NextResponse.json({ message: "Operación exitosa" })
  } catch (error) {
    console.error("Error in POST gestionar:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !canManageOvertime(user.rol)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const [bankingData, redemptionData, bankingHistory, redemptionHistory] = await Promise.all([
      prisma.jornadas.findMany({
        where: { estado_compensacion: "SOLICITADO" },
        orderBy: { fecha: "asc" },
        include: {
          usuarios_jornadas_empleado_idTousuarios: {
            select: { nombre: true, username: true },
          },
        },
      }),
      prisma.solicitudes_tiempo.findMany({
        where: { estado: "PENDIENTE" },
        orderBy: { fecha_inicio: "asc" },
        include: {
          usuarios_solicitudes_tiempo_usuario_idTousuarios: {
            select: { nombre: true, username: true },
          },
        },
      }),
      prisma.jornadas.findMany({
        where: { estado_compensacion: { in: ["APROBADO", "RECHAZADO"] } },
        orderBy: { fecha: "desc" },
        take: 50,
        include: {
          usuarios_jornadas_empleado_idTousuarios: {
            select: { nombre: true, username: true },
          },
        },
      }),
      prisma.solicitudes_tiempo.findMany({
        where: { estado: { not: "PENDIENTE" } },
        orderBy: { fecha_inicio: "desc" },
        take: 50,
        include: {
          usuarios_solicitudes_tiempo_usuario_idTousuarios: {
            select: { nombre: true, username: true },
          },
        },
      }),
    ])

    return NextResponse.json({
      banking: bankingData.map((item) => withUsuario(item, "usuarios_jornadas_empleado_idTousuarios")),
      redemption: redemptionData.map((item) => withUsuario(item, "usuarios_solicitudes_tiempo_usuario_idTousuarios")),
      bankingHistory: bankingHistory.map((item) => withUsuario(item, "usuarios_jornadas_empleado_idTousuarios")),
      redemptionHistory: redemptionHistory.map((item) => withUsuario(item, "usuarios_solicitudes_tiempo_usuario_idTousuarios")),
    })
  } catch (error) {
    console.error("Error fetching approvals:", error)
    return NextResponse.json({ message: "Error al cargar solicitudes" }, { status: 500 })
  }
}
