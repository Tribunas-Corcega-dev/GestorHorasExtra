import { NextResponse } from "next/server"
import { canManageOvertime } from "@/lib/permissions"
import { calculateScheduleSurcharges } from "@/lib/calculations"
import { logAudit } from "@/lib/logger"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

const ALLOWED_COLUMNS = [
  "h_acueducto",
  "h_alcantarillado",
  "h_aseo",
  "h_op_bocatoma",
  "h_admin",
  "h_planta_tratamiento",
  "h_planta_nocturna",
]

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request)

    if (!user || !canManageOvertime(user.rol)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const data = await prisma.horarios_base.findFirst()
    return NextResponse.json(data || {})
  } catch (error) {
    console.error("Error in GET horarios:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request)

    if (!user || !canManageOvertime(user.rol)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const body = await request.json()
    const { areaColumn, schedule, id } = body

    if (!areaColumn || !schedule) {
      return NextResponse.json({ message: "Faltan datos requeridos" }, { status: 400 })
    }

    if (!ALLOWED_COLUMNS.includes(areaColumn)) {
      return NextResponse.json({ message: "Area no valida" }, { status: 400 })
    }

    let nightShiftRange = { start: "21:00", end: "06:00" }
    const currentYear = new Date().getFullYear().toString()

    let params = await prisma.parametros.findFirst({
      where: { anio_vigencia: currentYear },
      select: { jornada_nocturna: true },
    })

    if (!params) {
      params = await prisma.parametros.findFirst({
        orderBy: { anio_vigencia: "desc" },
        select: { jornada_nocturna: true },
      })
    }

    if (params?.jornada_nocturna) {
      nightShiftRange = params.jornada_nocturna
    }

    const enrichedSchedule = calculateScheduleSurcharges(schedule, nightShiftRange)
    const dynamicData = { [areaColumn]: enrichedSchedule }

    let result
    if (id) {
      result = await prisma.horarios_base.update({
        where: { id },
        data: dynamicData,
      })
    } else {
      const existing = await prisma.horarios_base.findFirst({ select: { id: true } })
      if (existing) {
        result = await prisma.horarios_base.update({
          where: { id: existing.id },
          data: dynamicData,
        })
      } else {
        result = await prisma.horarios_base.create({ data: dynamicData })
      }
    }

    await logAudit({
      action: "UPDATE",
      entity: "CONFIGURACION",
      entityId: result.id,
      details: {
        target: "HORARIO_BASE",
        area: areaColumn,
        nuevo_horario: enrichedSchedule,
      },
      user,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in POST horarios:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
