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

        // Fetch the single parameters record (assuming only one exists or we want the latest)
        const { data, error } = await supabase
            .from("parametros")
            .select("*")
            .limit(1)
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 is "The result contains 0 rows"
            console.error("Error fetching parameters:", error)
            return NextResponse.json({ message: "Error al obtener parámetros" }, { status: 500 })
        }

        return NextResponse.json(data || {}) // Return empty object if no record found
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
        const { salario_minimo, anio_vigencia, jornada_nocturna, id } = body

        if (!anio_vigencia) {
            return NextResponse.json({ message: "Faltan datos requeridos" }, { status: 400 })
        }

        // Prepare update object with only defined fields
        const updates = { anio_vigencia }
        if (salario_minimo !== undefined) updates.salario_minimo = salario_minimo
        if (jornada_nocturna !== undefined) updates.jornada_nocturna = jornada_nocturna

        let result
        if (id) {
            // Update existing
            result = await supabase
                .from("parametros")
                .update(updates)
                .eq("id", id)
                .select()
                .single()
        } else {
            // Insert new (check if one exists first to avoid duplicates if we want singleton)
            const { data: existing } = await supabase.from("parametros").select("id").limit(1).single()

            if (existing) {
                result = await supabase
                    .from("parametros")
                    .update(updates)
                    .eq("id", existing.id)
                    .select()
                    .single()
            } else {
                result = await supabase
                    .from("parametros")
                    .insert([updates])
                    .select()
                    .single()
            }
        }

        if (result.error) {
            console.error("Error saving parameters:", result.error)
            return NextResponse.json({ message: "Error al guardar parámetros" }, { status: 500 })
        }

        // Auto-update employees if Minimum Wage changed
        if (updates.salario_minimo) {
            // Fetch employees with 'minimo' flag set to true
            const { data: employees } = await supabase
                .from("usuarios")
                .select("id, jornada_fija_hhmm")
                .eq("minimo", true)

            if (employees && employees.length > 0) {
                console.log(`Auto-updating ${employees.length} employees to new minimum wage: ${updates.salario_minimo}`)

                // Process updates in parallel or sequence
                const updatePromises = employees.map(async (emp) => {
                    try {
                        // Recalculate work values with new salary and existing schedule
                        const workValues = calculateEmployeeWorkValues(emp.jornada_fija_hhmm, updates.salario_minimo)

                        // Update employee
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

                // Wait for all to complete (or let them run in background if too many, but await suggests safety)
                await Promise.all(updatePromises)
            }
        }

        return NextResponse.json(result.data)
    } catch (error) {
        console.error("Error in POST parametros:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
