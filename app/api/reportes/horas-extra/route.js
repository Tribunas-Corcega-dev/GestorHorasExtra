import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"
import { createClient } from "@supabase/supabase-js"
import { canManageEmployees } from "@/lib/permissions"
import jwt from "jsonwebtoken"
import dayjs from "dayjs"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY // Fallback but warn

// Create a Supabase client with the Service Role Key to bypass RLS
const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function getUserFromRequest(request) {
    const token = request.cookies.get("auth_token")?.value
    if (!token) return null

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        // Use admin client to ensure we can verify user even if RLS is strict
        const { data: user } = await supabaseAdmin.from("usuarios").select("*").eq("id", decoded.id).single()
        return user
    } catch {
        return null
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

        // Enforce area filter for Coordinators
        if (user.rol === "COORDINADOR") {
            if (!user.area) {
                return NextResponse.json({ message: "Usuario no tiene área asignada" }, { status: 400 })
            }
            area = user.area
        }

        // Note: startDate and endDate are ignored for the totals because we are using the accumulated lifetime summary from resumen_horas_extra, as requested.

        // 1. Fetch employees
        let employeesQuery = supabaseAdmin
            .from("usuarios")
            .select("id, nombre, cc, area, rol, jornada_fija_hhmm, bolsa_horas_minutos")
            .eq("is_active", true)
            .neq("rol", "ADMINISTRADOR") // Exclude admins if needed

        if (area) {
            employeesQuery = employeesQuery.eq("area", area)
        }

        const { data: employees, error: employeesError } = await employeesQuery

        if (employeesError) throw employeesError

        // 2. Fetch all summaries (snapshot of current debt/credit)
        const { data: summaries, error: summariesError } = await supabaseAdmin
            .from("resumen_horas_extra")
            .select("usuario_id, acumulado_hhmm")


        if (summariesError) throw summariesError

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
