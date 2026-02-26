import { NextResponse } from "next/server"
import { canManageEmployees } from "@/lib/permissions"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(request) {
    try {
        const user = await getUserFromRequest(request)
        if (!user || (!canManageEmployees(user.rol) && user.rol !== "JEFE")) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        let area = searchParams.get("area")

        // Enforce area filter for Coordinators
        if (user.rol === "COORDINADOR") {
            if (!user.area) {
                return NextResponse.json({ message: "Usuario no tiene área asignada" }, { status: 400 })
            }
            area = user.area
        }

        // Note: startDate and endDate are ignored for the totals because we are using the accumulated lifetime summary from resumen_horas_extra, as requested.

        // 1. Fetch employees
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

        // 2. Fetch all summaries (snapshot of current debt/credit)
        const summaries = await prisma.resumen_horas_extra.findMany({
            select: {
                usuario_id: true,
                acumulado_hhmm: true,
            }
        })

        // Helper to format values
        const formatVal = (val) => Number(val) || 0;

        // 3. Map and Aggregate data
        const reportData = employees.map((emp) => {
            // Find summary for this employee
            const summaryRow = summaries.find(s => s.usuario_id === emp.id);
            const resumen = summaryRow ? summaryRow.acumulado_hhmm : {};

            // Map keys from resumen_horas_extra (snake_case) to frontend (short codes)
            const totals = {
                hed: formatVal(resumen.extra_diurna),
                hen: formatVal(resumen.extra_nocturna),
                hedf: formatVal(resumen.extra_diurna_festivo),
                henf: formatVal(resumen.extra_nocturna_festivo),
                rn: formatVal(resumen.recargo_nocturno),
                rdo: formatVal(resumen.dominical_festivo),
                rdon: formatVal(resumen.recargo_nocturno_festivo),
            }

            // Calculate total sum for display
            totals.total = Object.values(totals).reduce((a, b) => a + b, 0);

            // Only include if there's activity or a balance
            // Note: bolsa_horas_minutos might be positive (credit) or negative (debt)? Usually positive means they have time in bank.
            if (totals.total === 0 && (!emp.bolsa_horas_minutos || emp.bolsa_horas_minutos === 0)) {
                return null;
            }

            return {
                ...emp,
                bolsa_balance: emp.bolsa_horas_minutos || 0,
                totals,
            }
        }).filter(Boolean) // Remove nulls

        return NextResponse.json(reportData)

    } catch (error) {
        console.error("Error fetching overtime report:", error)
        return NextResponse.json({ message: "Error interno" }, { status: 500 })
    }
}
