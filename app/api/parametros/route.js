import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabaseClient"
import { canManageOvertime } from "@/lib/permissions"
import { calculateEmployeeWorkValues } from "@/lib/calculations"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

async function getUserFromRequest(request) {
    const token = request.cookies.get("auth_token")?.value
    if (!token) return null

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        const { data: user } = await supabase.from("usuarios").select("*").eq("id", decoded.id).single()
        return user
    } catch {
        return null
    }
}

export async function GET(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user || !canManageOvertime(user.rol)) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const year = searchParams.get("year") || new Date().getFullYear().toString()

        // Fetch parameters for the specific year
        const { data, error } = await supabase
            .from("parametros")
            .select("*")
            .eq("anio_vigencia", year)
            .single()

        if (error && error.code !== 'PGRST116') {
            console.error("Error fetching parameters:", error)
            return NextResponse.json({ message: "Error al obtener parámetros" }, { status: 500 })
        }

        // If not found for requested year, maybe try to return latest? 
        // Or just return empty so UI knows to create
        if (!data) {
            // Optional: Fallback to getting the latest configuration to pre-fill the form
            const { data: latest } = await supabase
                .from("parametros")
                .select("*")
                .order("anio_vigencia", { ascending: false })
                .limit(1)
                .single()

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
        const { salario_minimo, anio_vigencia, jornada_nocturna, limite_bolsa_horas } = body

        if (!anio_vigencia) {
            return NextResponse.json({ message: "Faltan datos requeridos (Año de Vigencia)" }, { status: 400 })
        }

        // Prepare update object
        const updates = { anio_vigencia }
        if (salario_minimo !== undefined) updates.salario_minimo = salario_minimo
        if (jornada_nocturna !== undefined) updates.jornada_nocturna = jornada_nocturna
        if (limite_bolsa_horas !== undefined) updates.limite_bolsa_horas = limite_bolsa_horas

        // Check if parameters exist for this year
        const { data: existing } = await supabase
            .from("parametros")
            .select("id")
            .eq("anio_vigencia", anio_vigencia)
            .single()

        let result
        if (existing) {
            // Update existing record for this year
            result = await supabase
                .from("parametros")
                .update(updates)
                .eq("id", existing.id)
                .select()
                .single()
        } else {
            // Insert new record for this year

            // If night shift range is not provided, inherit from previous year (latest record)
            if (!updates.jornada_nocturna) {
                const { data: latest } = await supabase
                    .from("parametros")
                    .select("jornada_nocturna")
                    .neq("anio_vigencia", anio_vigencia) // Exclude current if somehow exists (though we know it doesn't)
                    .order("anio_vigencia", { ascending: false })
                    .limit(1)
                    .single()

                if (latest && latest.jornada_nocturna) {
                    updates.jornada_nocturna = latest.jornada_nocturna
                } else {
                    // Default fallback if no previous history
                    updates.jornada_nocturna = "21:00-06:00"
                }
            }

            result = await supabase
                .from("parametros")
                .insert([updates])
                .select()
                .single()
        }

        if (result.error) {
            console.error("Error saving parameters:", result.error)
            return NextResponse.json({ message: "Error al guardar parámetros" }, { status: 500 })
        }

        // Auto-update employees logic...
        // Only if updating CURRENT YEAR or FUTURE YEAR? 
        // User asked to fix overwriting. Auto-update logic is separate.
        // Assuming we still want to auto-update based on the saved value if valid.
        // But warning: updating 2026 params shouldn't update employees NOW if it's 2025.
        // I'll keep logic simple: If saving params, update employees. 
        // Ideally we check `if (anio_vigencia == currentYear)`.

        const currentYear = new Date().getFullYear().toString()
        if (updates.salario_minimo && anio_vigencia == currentYear) {
            const { data: employees } = await supabase
                .from("usuarios")
                .select("id, jornada_fija_hhmm")
                .eq("minimo", true)
                .eq("is_active", true) // Only active

            if (employees && employees.length > 0) {
                const updatePromises = employees.map(async (emp) => {
                    try {
                        const workValues = calculateEmployeeWorkValues(emp.jornada_fija_hhmm, updates.salario_minimo)
                        await supabase
                            .from("usuarios")
                            .update({
                                salario_base: updates.salario_minimo,
                                horas_semanales: workValues.horas_semanales,
                                horas_mensuales: workValues.horas_mensuales,
                                valor_hora: workValues.valor_hora
                            })
                            .eq("id", emp.id)
                    } catch (err) {
                        console.error(`Failed to auto-update employee ${emp.id}:`, err)
                    }
                })
                await Promise.all(updatePromises)
            }
        }

        return NextResponse.json(result.data)
    } catch (error) {
        console.error("Error in POST parametros:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
