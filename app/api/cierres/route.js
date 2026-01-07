import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"
import { calculatePeriodFixedSurcharges } from "@/lib/calculations"

export async function POST(request) {
    try {
        const body = await request.json()
        const { empleado_id, periodo } = body // Periodo format: YYYY-MM-Q

        if (!empleado_id || !periodo) {
            return NextResponse.json({ message: "Faltan parámetros" }, { status: 400 })
        }

        const [year, month, quincena] = periodo.split('-').map(Number)

        // Determine start and end dates
        let startDate, endDate
        if (quincena === 1) {
            startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
            endDate = `${year}-${String(month + 1).padStart(2, '0')}-15`
        } else {
            startDate = `${year}-${String(month + 1).padStart(2, '0')}-16`
            const lastDay = new Date(year, month + 1, 0).getDate()
            endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`
        }

        // Check if closing already exists
        const { data: existingClosing } = await supabase
            .from("cierres_quincenales")
            .select("*")
            .eq("empleado_id", empleado_id)
            .eq("periodo_anio", year)
            .eq("periodo_mes", month)
            .eq("periodo_quincena", quincena)
            .single()

        if (existingClosing) {
            return NextResponse.json({ message: "Ya existe un cierre para este periodo", closing: existingClosing }, { status: 409 })
        }

        // --- CALCULATION LOGIC (Reused/Adapted) ---

        // 1. Fetch Employee Data
        const { data: empleado, error: empError } = await supabase
            .from("usuarios")
            .select("*")
            .eq("id", empleado_id)
            .single()

        if (empError || !empleado) {
            return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 })
        }

        let fixedSchedule = empleado.jornada_fija_hhmm
        if (typeof fixedSchedule === 'string') {
            try { fixedSchedule = JSON.parse(fixedSchedule) } catch (e) { }
        }

        // 2. Fetch Parameters
        const { data: params } = await supabase.from("parametros").select("*").single()
        const nightShiftRange = params?.jornada_nocturna

        // 3. Fetch Holidays
        let holidays = []
        try {
            const { data: festivosData } = await supabase
                .from("festivos")
                .select("fecha")
                .gte("fecha", startDate)
                .lte("fecha", endDate)

            if (festivosData) {
                holidays = festivosData.map(f => f.fecha)
            }
        } catch (e) {
            console.warn("Could not fetch holidays", e)
        }

        // 4. Calculate Fixed Surcharges
        const fixedSurcharges = calculatePeriodFixedSurcharges(
            startDate,
            endDate,
            fixedSchedule,
            nightShiftRange,
            holidays
        )

        // 5. Aggregate Reported Overtime (Variable)
        const { data: jornadas } = await supabase
            .from("jornadas")
            .select("*")
            .eq("empleado_id", empleado_id)
            .gte("fecha", startDate)
            .lte("fecha", endDate)
        // .eq("estado", "aprobado") // Only include approved? For now include all or filter in UI. Let's assume we close whatever is there.

        const reportedOvertime = {
            extra_diurna: 0, extra_nocturna: 0, extra_diurna_festivo: 0, extra_nocturna_festivo: 0,
            recargo_nocturno: 0, dominical_festivo: 0, recargo_nocturno_festivo: 0
        }

        jornadas?.forEach(jornada => {
            if (jornada.horas_extra_hhmm) {
                const breakdown = jornada.horas_extra_hhmm.breakdown || {}
                const flatBreakdown = { ...(jornada.horas_extra_hhmm.flatBreakdown || breakdown) }

                // Compensatory Time Deduction Logic
                if (jornada.horas_para_bolsa_minutos > 0 && ['SOLICITADO', 'APROBADO'].includes(jornada.estado_compensacion)) {
                    let minutesToDeduct = jornada.horas_para_bolsa_minutos

                    // Priority of deduction: Diurna -> Nocturna -> Diurna Festivo -> Nocturna Festivo
                    // We typically bank "extra" hours. Surcharges (recargos) are often paid regardless, 
                    // but if the employee is absent (Compensatory), they effectively traded the whole overtime event.
                    // Implementation: Subtract from pure overtime types first.
                    const typesToDeduct = ['extra_diurna', 'extra_nocturna', 'extra_diurna_festivo', 'extra_nocturna_festivo']

                    for (const type of typesToDeduct) {
                        if (minutesToDeduct <= 0) break
                        if (flatBreakdown[type] > 0) {
                            const deduct = Math.min(flatBreakdown[type], minutesToDeduct)
                            flatBreakdown[type] -= deduct
                            minutesToDeduct -= deduct
                        }
                    }
                }

                Object.entries(flatBreakdown).forEach(([k, v]) => {
                    if (reportedOvertime[k] !== undefined) {
                        reportedOvertime[k] += v
                    }
                })
            }
        })

        // 6. Calculate Total Value
        const { data: recargos } = await supabase.from("recargos_he").select("*")
        let totalValue = 0

        if (empleado.valor_hora && recargos) {
            // Value from Fixed Surcharges
            Object.entries(fixedSurcharges).forEach(([key, minutes]) => {
                const surchargeType = recargos.find(r => normalizeType(r.tipo_hora_extra) === key)
                if (surchargeType) {
                    const hours = minutes / 60
                    const percentage = surchargeType.recargo > 2 ? surchargeType.recargo / 100 : surchargeType.recargo
                    totalValue += hours * empleado.valor_hora * percentage
                }
            })

            // Value from Reported Overtime
            // Use the same logic as in the UI or calculateTotalOvertimeValue
            // We need to iterate reportedOvertime and calculate value
            Object.entries(reportedOvertime).forEach(([key, minutes]) => {
                if (minutes > 0) {
                    const surchargeType = recargos.find(r => normalizeType(r.tipo_hora_extra) === key)
                    if (surchargeType) {
                        const percentage = surchargeType.recargo > 2 ? surchargeType.recargo / 100 : surchargeType.recargo
                        const hours = minutes / 60

                        // Factor logic: 
                        // If it's overtime (extra_...), factor = 1 + percentage
                        // If it's surcharge (recargo_...), factor = percentage (usually, but verify consistency)
                        // In UI we used 1+p for everything in calculateTotalOvertimeValue? 
                        // Let's stick to the logic: Overtime = 1+p, Surcharge = p.
                        // Wait, previous UI logic (Step 589) used `1 + p` for everything.
                        // "User requested formula: valor_hora + (valor_hora * recargo) => 1 + percentage"
                        // I will respect that request for consistency.

                        const factor = 1 + percentage
                        totalValue += hours * empleado.valor_hora * factor
                    }
                }
            })
        }

        // 7. Insert into DB
        const { data: newClosing, error: insertError } = await supabase
            .from("cierres_quincenales")
            .insert({
                empleado_id,
                periodo_anio: year,
                periodo_mes: month,
                periodo_quincena: quincena,
                recargos_fijos: fixedSurcharges,
                horas_extra_reportadas: reportedOvertime,
                valor_total: totalValue,
                estado: 'borrador'
            })
            .select()
            .single()

        if (insertError) {
            console.error("Error inserting closing:", insertError)
            return NextResponse.json({ message: "Error al guardar el cierre" }, { status: 500 })
        }

        return NextResponse.json(newClosing)

    } catch (error) {
        console.error("Error processing closing:", error)
        return NextResponse.json({ message: "Error interno" }, { status: 500 })
    }
}

function normalizeType(dbType) {
    if (!dbType) return ""
    // Reuse normalization logic from calculations.js (or import it if exported)
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
        "recargo nocturno festivo": "recargo_nocturno_festivo"
    }
    return map[normalized] || dbType
}
