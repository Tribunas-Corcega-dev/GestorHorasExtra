import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { jornada_id, minutos } = body

    if (!jornada_id || !minutos || minutos <= 0) {
      return NextResponse.json({ message: "Datos inválidos" }, { status: 400 })
    }

    await prisma.$transaction(
      async (tx) => {
        const jornada = await tx.jornadas.findUnique({
          where: { id: jornada_id },
          select: {
            id: true,
            empleado_id: true,
            estado_compensacion: true,
          },
        })

        if (!jornada) {
          throw new Error("JORNADA_NOT_FOUND")
        }

        if (jornada.empleado_id !== user.id) {
          throw new Error("UNAUTHORIZED")
        }

        if (jornada.estado_compensacion !== "NINGUNO" && jornada.estado_compensacion !== "RECHAZADO") {
          throw new Error("ALREADY_REQUESTED")
        }

        await tx.jornadas.update({
          where: { id: jornada_id },
          data: {
            horas_para_bolsa_minutos: minutos,
            estado_compensacion: "SOLICITADO",
          },
        })

        await tx.historial_bolsa.create({
          data: {
            usuario_id: user.id,
            tipo_movimiento: "AJUSTE",
            minutos: 0,
            saldo_resultante: user.bolsa_horas_minutos || 0,
            referencia_id: jornada_id,
            observacion: `Solicitud de acumulación por ${minutos} minutos`,
            realizado_por: user.id,
          },
        })
      },
      { isolationLevel: "Serializable" }
    )

    return NextResponse.json({ message: "Solicitud enviada correctamente" })
  } catch (error) {
    if (error?.message === "JORNADA_NOT_FOUND") {
      return NextResponse.json({ message: "Jornada no encontrada" }, { status: 404 })
    }

    if (error?.message === "UNAUTHORIZED") {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    if (error?.message === "ALREADY_REQUESTED") {
      return NextResponse.json({ message: "Ya existe una solicitud para esta jornada" }, { status: 400 })
    }

    console.error("Error in POST acumular:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
