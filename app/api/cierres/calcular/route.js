import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"
import { calculatePeriodFixedSurcharges, calculateEmployeeWorkValues, getSalaryForDate } from "@/lib/calculations"

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const empleado_id = searchParams.get("empleado_id")
        const periodo = searchParams.get("periodo") // Format: YYYY-MM-Q (e.g., 2025-12-1)

        if (!empleado_id || !periodo) {
            return NextResponse.json({ message: "Faltan parámetros" }, { status: 400 })
        }

        const [year, month, quincena] = periodo.split('-').map(Number)

        // Determine start and end dates
        // Determine start and end dates
        let startDate, endDate
        if (quincena === 1) {
            startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
            endDate = `${year}-${String(month + 1).padStart(2, '0')}-15`
        } else if (quincena === 2) {
            startDate = `${year}-${String(month + 1).padStart(2, '0')}-16`
            // Get last day of month
            const lastDay = new Date(year, month + 1, 0).getDate()
            endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`
        } else if (quincena === 0) {
            // Full Month
            startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
            const lastDay = new Date(year, month + 1, 0).getDate()
            endDate = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`
        } else {
            return NextResponse.json({ message: "Quincena inválida" }, { status: 400 })
        }

        // 1. Fetch Employee Data (Schedule)
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

        // 2. Fetch Parameters (Night Shift) for the Period Year
        const { data: params } = await supabase
            .from("parametros")
            .select("*")
            .eq("anio_vigencia", year)
            .single()

        // Fallback to latest if not found (or handle error)
        let effectiveParams = params
        if (!effectiveParams) {
            const { data: latest } = await supabase.from("parametros").select("*").limit(1).single()
            effectiveParams = latest
        }

        const nightShiftRange = effectiveParams?.jornada_nocturna || "21:00-06:00"

        // Recalculate salary for this period if employee is on minimum wage
        if (empleado.minimo && effectiveParams?.salario_minimo) {
            const workValues = calculateEmployeeWorkValues(fixedSchedule, effectiveParams.salario_minimo)
            empleado.valor_hora = workValues.valor_hora
        }

        // 3. Fetch Holidays (Festivos)
        // Try to fetch from 'festivos' table if it exists, otherwise empty
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
            console.warn("Could not fetch holidays, table might not exist yet", e)
        }

        // 4. Calculate Fixed Surcharges
        const fixedSurcharges = calculatePeriodFixedSurcharges(
            startDate,
            endDate,
            fixedSchedule,
            nightShiftRange,
            holidays
        )

        // Calculate Value
        // Determine effective hourly rate for this period (using End Date)
        let hourlyRate = empleado.valor_hora
        if (empleado.hist_salarios && Array.isArray(empleado.hist_salarios)) {
            const historySalary = getSalaryForDate(empleado.hist_salarios, endDate)
            if (historySalary) hourlyRate = historySalary.hourlyRate
        }

        // Fetch surcharges percentages
        const { data: recargos } = await supabase.from("recargos_he").select("*")
        let totalValue = 0

        if (hourlyRate && recargos) {
            Object.entries(fixedSurcharges).forEach(([key, minutes]) => {
                const surchargeType = recargos.find(r => normalizeType(r.tipo_hora_extra) === key)
                if (surchargeType) {
                    // Calculate value: (minutes/60) * valor_hora * percentage
                    // Note: Surcharges (Recargos) are paid as just the percentage factor usually, 
                    // but the user's formula was 1 + percentage for overtime. 
                    // For pure surcharges (recargo nocturno), it's usually just 0.35 * rate.
                    // Let's check calculations.js logic.
                    // calculateOvertimeValue uses (1 + percentage). 
                    // If it's a surcharge, we usually want just the surcharge part if the base is already paid in salary.
                    // However, for simplicity and consistency with the user's previous "1+percentage" request, 
                    // I'll stick to the existing helper or adjust if needed.
                    // Actually, for *fixed* payroll surcharges, the base salary covers the "1", so we only pay the "0.35".
                    // Let's assume we pay only the surcharge percentage for these fixed hours.

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
            holidaysFound: holidays.length
        })

    } catch (error) {
        console.error("Error calculating closing:", error)
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
