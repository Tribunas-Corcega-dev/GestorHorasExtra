import { NextResponse } from "next/server"
import { calculatePeriodFixedSurcharges, getSalaryForDate, getRecargoPaymentFactor, normalizeOvertimeType } from "@/lib/calculations"
import { prisma } from "@/lib/prisma"

export async function POST(request) {
  try {
    const body = await request.json()
    const { empleado_id, periodo } = body

    if (!empleado_id || !periodo) {
      return NextResponse.json({ message: "Faltan parametros" }, { status: 400 })
    }

    const [year, month, quincena] = periodo.split("-").map(Number)

    let startDate
    let endDate
    if (quincena === 1) {
      startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`
      endDate = `${year}-${String(month + 1).padStart(2, "0")}-15`
    } else {
      startDate = `${year}-${String(month + 1).padStart(2, "0")}-16`
      const lastDay = new Date(year, month + 1, 0).getDate()
      endDate = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`
    }

    const existingClosing = await prisma.cierres_quincenales.findFirst({
      where: {
        empleado_id,
        periodo_anio: year,
        periodo_mes: month,
        periodo_quincena: quincena,
      },
    })

    if (existingClosing) {
      return NextResponse.json({ message: "Ya existe un cierre para este periodo", closing: existingClosing }, { status: 409 })
    }

    const empleado = await prisma.usuarios.findUnique({ where: { id: empleado_id } })

    if (!empleado) {
      return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 })
    }

    let fixedSchedule = empleado.jornada_fija_hhmm
    if (typeof fixedSchedule === "string") {
      try {
        fixedSchedule = JSON.parse(fixedSchedule)
      } catch {
        fixedSchedule = null
      }
    }

    const params = await prisma.parametros.findFirst({ orderBy: { anio_vigencia: "desc" } })
    const nightShiftRange = params?.jornada_nocturna
    const recargos = await prisma.recargos_he.findMany()

    const festivosData = await prisma.festivos.findMany({
      where: {
        fecha: {
          gte: new Date(`${startDate}T00:00:00.000Z`),
          lte: new Date(`${endDate}T23:59:59.999Z`),
        },
      },
      select: { fecha: true },
    })
    const holidays = festivosData.map((f) => f.fecha)

    const fixedSurcharges = calculatePeriodFixedSurcharges(startDate, endDate, fixedSchedule, nightShiftRange, holidays)

    const jornadas = await prisma.jornadas.findMany({
      where: {
        empleado_id,
        fecha: {
          gte: new Date(`${startDate}T00:00:00.000Z`),
          lte: new Date(`${endDate}T23:59:59.999Z`),
        },
      },
    })

    const reportedOvertime = {
      extra_diurna: 0,
      extra_nocturna: 0,
      extra_diurna_festivo: 0,
      extra_nocturna_festivo: 0,
      recargo_nocturno: 0,
      dominical_festivo: 0,
      recargo_nocturno_festivo: 0,
    }
    let totalValue = 0

    jornadas.forEach((jornada) => {
      if (!jornada.horas_extra_hhmm) return

      const breakdown = jornada.horas_extra_hhmm.breakdown || {}
      const flatBreakdown = { ...(jornada.horas_extra_hhmm.flatBreakdown || breakdown) }

      if (jornada.horas_para_bolsa_minutos > 0 && ["SOLICITADO", "APROBADO"].includes(jornada.estado_compensacion)) {
        let minutesToDeduct = jornada.horas_para_bolsa_minutos
        const typesToDeduct = ["extra_diurna", "extra_nocturna", "extra_diurna_festivo", "extra_nocturna_festivo"]

        for (const type of typesToDeduct) {
          if (minutesToDeduct <= 0) break
          if (flatBreakdown[type] > 0) {
            const deduct = Math.min(flatBreakdown[type], minutesToDeduct)
            flatBreakdown[type] -= deduct
            minutesToDeduct -= deduct
          }
        }
      }

      let jornadaRate = 0
      const historySalary = getSalaryForDate(empleado.hist_salarios, jornada.fecha)
      if (historySalary) {
        jornadaRate = Number(historySalary.hourlyRate)
      } else if (jornada.valor_hora_snapshot) {
        jornadaRate = Number(jornada.valor_hora_snapshot)
      } else {
        jornadaRate = Number(empleado.valor_hora)
      }

      Object.entries(flatBreakdown).forEach(([k, minutes]) => {
        if (reportedOvertime[k] !== undefined) {
          reportedOvertime[k] += minutes
        }
        if (minutes > 0 && jornadaRate > 0 && recargos) {
          const surchargeType = recargos.find((r) => normalizeOvertimeType(r.tipo_hora_extra) === k)
          if (surchargeType) {
            const hours = minutes / 60
            const factor = getRecargoPaymentFactor(surchargeType.recargo, k)
            totalValue += hours * jornadaRate * factor
          }
        }
      })
    })

    let fixedHourlyRate = empleado.valor_hora
    if (empleado.hist_salarios && Array.isArray(empleado.hist_salarios)) {
      const historySalary = getSalaryForDate(empleado.hist_salarios, endDate)
      if (historySalary) fixedHourlyRate = historySalary.hourlyRate
    }

    if (fixedHourlyRate && recargos) {
      Object.entries(fixedSurcharges).forEach(([key, minutes]) => {
        const surchargeType = recargos.find((r) => normalizeOvertimeType(r.tipo_hora_extra) === key)
        if (surchargeType) {
          const hours = minutes / 60
          const factor = getRecargoPaymentFactor(surchargeType.recargo, key)
          totalValue += hours * fixedHourlyRate * factor
        }
      })
    }

    const newClosing = await prisma.cierres_quincenales.create({
      data: {
        empleado_id,
        periodo_anio: year,
        periodo_mes: month,
        periodo_quincena: quincena,
        recargos_fijos: fixedSurcharges,
        horas_extra_reportadas: reportedOvertime,
        valor_total: totalValue,
        estado: "borrador",
      },
    })

    return NextResponse.json(newClosing)
  } catch (error) {
    console.error("Error processing closing:", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

