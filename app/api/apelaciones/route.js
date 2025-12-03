import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabaseClient"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

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

export async function POST(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const formData = await request.formData()
        const jornadaId = formData.get("jornada_id")
        const motivo = formData.get("motivo")
        const files = formData.getAll("files")

        if (!jornadaId || !motivo) {
            return NextResponse.json({ message: "Faltan datos requeridos" }, { status: 400 })
        }

        // Verify the jornada belongs to the user
        const { data: jornada, error: jornadaError } = await supabase
            .from("jornadas")
            .select("empleado_id")
            .eq("id", jornadaId)
            .single()

        if (jornadaError || !jornada) {
            return NextResponse.json({ message: "Jornada no encontrada" }, { status: 404 })
        }

        if (jornada.empleado_id !== user.id) {
            return NextResponse.json({ message: "No autorizado para apelar esta jornada" }, { status: 403 })
        }

        // Get current date for folder structure
        const currentDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD

        // Create folder path: apelaciones/{date}/{employee_cc}/
        const folderPath = `${currentDate}/${user.cc}`
        let docsUrl = null

        // Upload files to Supabase Storage if any
        if (files && files.length > 0 && files[0].size > 0) {
            for (const file of files) {
                const fileName = file.name
                const filePath = `${folderPath}/${fileName}`

                // Convert file to buffer
                const arrayBuffer = await file.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                // Upload to Supabase Storage using admin client (bypasses RLS)
                const { error: uploadError } = await supabaseAdmin.storage
                    .from("apelaciones")
                    .upload(filePath, buffer, {
                        contentType: file.type,
                        upsert: true
                    })

                if (uploadError) {
                    console.error("Error uploading file:", uploadError)
                    return NextResponse.json({
                        message: `Error al subir archivo ${fileName}: ${uploadError.message}`
                    }, { status: 500 })
                }
            }
            // If all uploads succeeded, set the docs_url
            docsUrl = `apelaciones/${folderPath}`
        }

        // Insert appeal record into database
        const { data: newApeal, error: apealError } = await supabase
            .from("apelaciones")
            .insert([
                {
                    empleado_id: user.id,
                    jornada_id: jornadaId,
                    fecha: currentDate,
                    motivo: motivo,
                    estado: "PENDIENTE",
                    docs_url: docsUrl
                }
            ])
            .select()
            .single()

        if (apealError) {
            console.error("Error creating appeal:", apealError)
            return NextResponse.json({
                message: `Error al crear apelación: ${apealError.message}`
            }, { status: 500 })
        }

        return NextResponse.json({
            message: "Apelación enviada exitosamente",
            appeal: newApeal
        }, { status: 201 })

    } catch (error) {
        console.error("Error in POST apelaciones:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}

export async function GET(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        // Only HR and Coordinators can view appeals
        const canViewAppeals = ["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "JEFE", "COORDINADOR"].includes(user.rol)

        if (!canViewAppeals) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const estado = searchParams.get("estado") || "PENDIENTE"

        // Fetch appeals with employee and jornada data
        let query = supabase
            .from("apelaciones")
            .select(`
                *,
                empleado:usuarios!apelaciones_empleado_id_fkey(id, nombre, username, cc, foto_url, area),
                jornada:jornadas!apelaciones_jornada_id_fkey(id, fecha, jornada_base_calcular, horas_extra_hhmm, es_festivo)
            `)
            .order("fecha", { ascending: false })

        // Filter by area if user is COORDINADOR
        if (user.rol === "COORDINADOR") {
            // We need to filter based on the joined employee table
            // In Supabase JS client, we can filter on foreign tables using !inner
            query = supabase
                .from("apelaciones")
                .select(`
                    *,
                    empleado:usuarios!apelaciones_empleado_id_fkey!inner(id, nombre, username, cc, foto_url, area),
                    jornada:jornadas!apelaciones_jornada_id_fkey(id, fecha, jornada_base_calcular, horas_extra_hhmm, es_festivo)
                `)
                .eq("empleado.area", user.area)
                .order("fecha", { ascending: false })
        }

        if (estado) {
            query = query.eq("estado", estado)
        }

        const { data: appeals, error } = await query

        if (error) {
            console.error("Error fetching appeals:", error)
            return NextResponse.json({
                message: `Error al obtener apelaciones: ${error.message}`
            }, { status: 500 })
        }

        return NextResponse.json(appeals)

    } catch (error) {
        console.error("Error in GET apelaciones:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
