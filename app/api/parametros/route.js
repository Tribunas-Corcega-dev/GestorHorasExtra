import { NextResponse } from "next/server"
import { canManageOvertime } from "@/lib/permissions"
import { calculateEmployeeWorkValues } from "@/lib/calculations"
import { appendSalaryHistoryEntry } from "@/lib/salaryHistory"
import { logAudit } from "@/lib/logger"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request)

    if (!user || !canManageOvertime(user.rol)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get("year") || new Date().getFullYear().toString()

    const data = await prisma.parametros.findFirst({
      where: { anio_vigencia: year },
    })

    if (!data) {
      const latest = await prisma.parametros.findFirst({
        orderBy: { anio_vigencia: "desc" },
      })

      if (latest) return NextResponse.json(latest)
      return NextResponse.json({})
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in GET parametros:", error)
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
    const { salario_minimo, anio_vigencia, jornada_nocturna, limite_bolsa_horas, fecha_aplicacion } = body

    if (!anio_vigencia) {
      return NextResponse.json({ message: "Faltan datos requeridos (Ano de Vigencia)" }, { status: 400 })
    }

    const updates = { anio_vigencia }
    if (salario_minimo !== undefined) updates.salario_minimo = salario_minimo
    if (jornada_nocturna !== undefined) updates.jornada_nocturna = jornada_nocturna
    if (limite_bolsa_horas !== undefined) updates.limite_bolsa_horas = limite_bolsa_horas

    const existing = await prisma.parametros.findFirst({
      where: { anio_vigencia },
      select: { id: true },
    })

    if (!existing && !updates.jornada_nocturna) {
      const latest = await prisma.parametros.findFirst({
        where: { anio_vigencia: { not: anio_vigencia } },
        orderBy: { anio_vigencia: "desc" },
        select: { jornada_nocturna: true },
      })

      updates.jornada_nocturna = latest?.jornada_nocturna || "21:00-06:00"
    }

    const result = existing
      ? await prisma.parametros.update({
          where: { id: existing.id },
          data: updates,
        })
      : await prisma.parametros.create({
          data: updates,
        })

    await logAudit({
      action: "UPDATE",
      entity: "CONFIGURACION",
      entityId: result.id,
      details: {
        target: "PARAMETROS_GLOBALES",
        anio: anio_vigencia,
        updates,
      },
      user,
    })

    if (updates.salario_minimo) {
      const employees = await prisma.usuarios.findMany({
        where: {
          minimo: true,
          is_active: true,
        },
        select: {
          id: true,
          jornada_fija_hhmm: true,
          salario_base: true,
          valor_hora: true,
        },
      })

      if (employees.length > 0) {
        await Promise.all(
          employees.map(async (emp) => {
            try {
              const workValues = calculateEmployeeWorkValues(emp.jornada_fija_hhmm, updates.salario_minimo)

              await prisma.$transaction(async (tx) => {
                await tx.usuarios.update({
                  where: { id: emp.id },
                  data: {
                    salario_base: updates.salario_minimo,
                    horas_semanales: workValues.horas_semanales,
                    horas_mensuales: workValues.horas_mensuales,
                    valor_hora: workValues.valor_hora,
                  },
                })

                await appendSalaryHistoryEntry(tx, {
                  usuarioId: emp.id,
                  effectiveDate: fecha_aplicacion || new Date().toISOString(),
                  salarioBase: updates.salario_minimo,
                  valorHora: workValues.valor_hora,
                  horasSemanales: workValues.horas_semanales,
                  horasMensuales: workValues.horas_mensuales,
                  motivo: "Aumento SMLV",
                  origen: "AUMENTO_SMLV",
                  createdBy: user.id,
                })
              })
            } catch (err) {
              console.error(`Failed to auto-update employee ${emp.id}:`, err)
            }
          })
        )
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in POST parametros:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
