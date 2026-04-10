import { NextResponse } from "next/server"
import { canManageEmployees } from "@/lib/permissions"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

function safeNumber(value) {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
}

function emptyTotals() {
    return {
        hed: 0,
        hen: 0,
        hedf: 0,
        henf: 0,
        rn: 0,
        rdo: 0,
        rdon: 0,
        total: 0,
    }
}

function extractBreakdown(rawHorasExtra) {
    const container = rawHorasExtra && typeof rawHorasExtra === "object" ? rawHorasExtra : {}
    const breakdown = container.breakdown && typeof container.breakdown === "object" ? container.breakdown : {}
    const overtime = breakdown.overtime && typeof breakdown.overtime === "object" ? breakdown.overtime : {}
    const surcharges = breakdown.surcharges && typeof breakdown.surcharges === "object" ? breakdown.surcharges : {}

    return {
        extra_diurna: safeNumber(breakdown.extra_diurna ?? overtime.extra_diurna),
        extra_nocturna: safeNumber(breakdown.extra_nocturna ?? overtime.extra_nocturna),
        extra_diurna_festivo: safeNumber(breakdown.extra_diurna_festivo ?? overtime.extra_diurna_festivo),
        extra_nocturna_festivo: safeNumber(breakdown.extra_nocturna_festivo ?? overtime.extra_nocturna_festivo),
        recargo_nocturno: safeNumber(breakdown.recargo_nocturno ?? surcharges.recargo_nocturno),
        dominical_festivo: safeNumber(breakdown.dominical_festivo ?? surcharges.dominical_festivo),
        recargo_nocturno_festivo: safeNumber(breakdown.recargo_nocturno_festivo ?? surcharges.recargo_nocturno_festivo),
    }
}

export async function GET(request) {
    try {
        const user = await getUserFromRequest(request)
        if (!user || (!canManageEmployees(user.rol) && user.rol !== "JEFE")) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        let area = searchParams.get("area")
        const inicio = searchParams.get("inicio")
        const fin = searchParams.get("fin")

        if (user.rol === "COORDINADOR") {
            if (!user.area) {
                return NextResponse.json({ message: "Usuario no tiene area asignada" }, { status: 400 })
            }
            area = user.area
        }

        const employees = await prisma.usuarios.findMany({
            where: {
                is_active: true,
                rol: { not: "ADMINISTRADOR" },
                ...(area ? { area } : {}),
            },
            select: {
                id: true,
                nombre: true,
                cc: true,
                area: true,
                rol: true,
                jornada_fija_hhmm: true,
                bolsa_horas_minutos: true,
            }
        })

        const employeeIds = employees.map((emp) => emp.id).filter(Boolean)

        let totalsByUser = new Map()

        if (inicio || fin) {
            const whereFecha = {
                ...(inicio ? { gte: new Date(`${inicio}T00:00:00`) } : {}),
                ...(fin ? { lte: new Date(`${fin}T23:59:59`) } : {}),
            }

            const jornadas = employeeIds.length > 0
                ? await prisma.jornadas.findMany({
                    where: {
                        empleado_id: { in: employeeIds },
                        ...(Object.keys(whereFecha).length ? { fecha: whereFecha } : {}),
                    },
                    select: {
                        empleado_id: true,
                        horas_extra_hhmm: true,
                    }
                })
                : []

            totalsByUser = jornadas.reduce((acc, jornada) => {
                const uid = jornada.empleado_id
                if (!uid) return acc

                const extracted = extractBreakdown(jornada.horas_extra_hhmm)
                const current = acc.get(uid) || emptyTotals()

                current.hed += extracted.extra_diurna
                current.hen += extracted.extra_nocturna
                current.hedf += extracted.extra_diurna_festivo
                current.henf += extracted.extra_nocturna_festivo
                current.rn += extracted.recargo_nocturno
                current.rdo += extracted.dominical_festivo
                current.rdon += extracted.recargo_nocturno_festivo
                current.total = current.hed + current.hen + current.hedf + current.henf + current.rn + current.rdo + current.rdon

                acc.set(uid, current)
                return acc
            }, new Map())
        } else {
            const summaries = await prisma.resumen_horas_extra.findMany({
                select: {
                    usuario_id: true,
                    acumulado_hhmm: true,
                }
            })

            totalsByUser = summaries.reduce((acc, summary) => {
                const resumen = summary.acumulado_hhmm || {}
                const totals = {
                    hed: safeNumber(resumen.extra_diurna),
                    hen: safeNumber(resumen.extra_nocturna),
                    hedf: safeNumber(resumen.extra_diurna_festivo),
                    henf: safeNumber(resumen.extra_nocturna_festivo),
                    rn: safeNumber(resumen.recargo_nocturno),
                    rdo: safeNumber(resumen.dominical_festivo),
                    rdon: safeNumber(resumen.recargo_nocturno_festivo),
                    total: 0,
                }
                totals.total = totals.hed + totals.hen + totals.hedf + totals.henf + totals.rn + totals.rdo + totals.rdon
                acc.set(summary.usuario_id, totals)
                return acc
            }, new Map())
        }

        const reportData = employees.map((emp) => {
            const totals = totalsByUser.get(emp.id) || emptyTotals()

            if (totals.total === 0 && (!emp.bolsa_horas_minutos || emp.bolsa_horas_minutos === 0)) {
                return null
            }

            return {
                ...emp,
                bolsa_balance: emp.bolsa_horas_minutos || 0,
                compensacion_tiempo_balance: emp.bolsa_horas_minutos || 0,
                totals,
            }
        }).filter(Boolean)

        return NextResponse.json(reportData)
    } catch (error) {
        console.error("Error fetching overtime report:", error)
        return NextResponse.json({ message: "Error interno" }, { status: 500 })
    }
}