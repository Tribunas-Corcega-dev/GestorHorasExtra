import { NextResponse } from "next/server"
import { calculatePeriodFixedSurcharges, calculateEmployeeWorkValues, getSalaryForDate } from "@/lib/calculations"
import { prisma } from "@/lib/prisma"

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const empleado_id = searchParams.get("empleado_id")
    const periodo = searchParams.get("periodo")

    if (!empleado_id || !periodo) {
      return NextResponse.json({ message: "Faltan parametros" }, { status: 400 })
    }

    const [year, month, quincena] = periodo.split("-").map(Number)

    let startDate
    let endDate
    if (quincena === 1) {
      startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`
      endDate = `${year}-${String(month + 1).padStart(2, "0")}-15`
    } else if (quincena === 2) {
      startDate = `${year}-${String(month + 1).padStart(2, "0")}-16`
      const lastDay = new Date(year, month + 1, 0).getDate()
      endDate = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`
    } else if (quincena === 0) {
      startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`
      const lastDay = new Date(year, month + 1, 0).getDate()
      endDate = `${year}-${String(month + 1).padStart(2, "0")}-${lastDay}`
    } else {
      return NextResponse.json({ message: "Quincena invalida" }, { status: 400 })
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

    let effectiveParams = await prisma.parametros.findFirst({
      where: { anio_vigencia: String(year) },
    })

    if (!effectiveParams) {
      effectiveParams = await prisma.parametros.findFirst({ orderBy: { anio_vigencia: "desc" } })
    }

    const nightShiftRange = effectiveParams?.jornada_nocturna || "21:00-06:00"

    if (empleado.minimo && effectiveParams?.salario_minimo) {
      const workValues = calculateEmployeeWorkValues(fixedSchedule, effectiveParams.salario_minimo)
      empleado.valor_hora = workValues.valor_hora
    }

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

    let hourlyRate = empleado.valor_hora
    if (empleado.hist_salarios && Array.isArray(empleado.hist_salarios)) {
      const historySalary = getSalaryForDate(empleado.hist_salarios, endDate)
      if (historySalary) hourlyRate = historySalary.hourlyRate
    }

    const recargos = await prisma.recargos_he.findMany()
    let totalValue = 0

    if (hourlyRate && recargos) {
      Object.entries(fixedSurcharges).forEach(([key, minutes]) => {
        const surchargeType = recargos.find((r) => normalizeType(r.tipo_hora_extra) === key)
        if (surchargeType) {
          const hours = minutes / 60
          const percentage = surchargeType.recargo > 2 ? surchargeType.recargo / 100 : surchargeType.recargo
          totalValue += hours * hourlyRate * percentage
        }
      })
    }

    return NextResponse.json({
      periodo,
      startDate,
      endDate,
      fixedSurcharges,
      totalValue,
      holidaysFound: holidays.length,
    })
  } catch (error) {
    console.error("Error calculating closing:", error)
    return NextResponse.json({ message: "Error interno" }, { status: 500 })
  }
}

function normalizeType(dbType) {
  if (!dbType) return ""
  const normalized = dbType.trim().toLowerCase()
  const map = {
    "extra diurno": "extra_diurna",
    "trabajo extra nocturno": "extra_nocturna",
    "extra nocturna": "extra_nocturna",
    "trabajo extra diurno dominical y festivo": "extra_diurna_festivo",
    "extra diurna festivo": "extra_diurna_festivo",
    "trabajo extra nocturno en domingos y festivos": "extra_nocturna_festivo",
    "extra nocturna festivo": "extra_nocturna_festivo",
    "recargo nocturno": "recargo_nocturno",
    "trabajo nocturno": "recargo_nocturno",
    "trabajo dominical y festivo": "dominical_festivo",
    "dominical/festivo": "dominical_festivo",
    "trabajo nocturno en dominical y festivo": "recargo_nocturno_festivo",
    "recargo nocturno festivo": "recargo_nocturno_festivo",
  }
  return map[normalized] || dbType
}
