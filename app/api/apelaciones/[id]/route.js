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

export async function GET(request, context) {
    try {
        const user = await getUserFromRequest(request)

        if (!user) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        // Only HR can view appeal details
        const canViewAppeals = ["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "JEFE"].includes(user.rol)

        if (!canViewAppeals) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const params = await context.params
        const { id } = params

        // Fetch appeal with all related data
        const { data: appeal, error } = await supabase
            .from("apelaciones")
            .select(`
                *,
                empleado:usuarios!apelaciones_empleado_id_fkey(id, nombre, username, cc, foto_url, area, valor_hora),
                jornada:jornadas!apelaciones_jornada_id_fkey(id, fecha, jornada_base_calcular, horas_extra_hhmm, es_festivo)
            `)
            .eq("id", id)
            .single()

        if (error) {
            console.error("Error fetching appeal:", error)
            return NextResponse.json({
                message: `Error al obtener apelación: ${error.message}`
            }, { status: 500 })
        }

        if (!appeal) {
            return NextResponse.json({ message: "Apelación no encontrada" }, { status: 404 })
        }

        // Get file URLs if docs_url exists
        let files = []
        if (appeal.docs_url) {
            try {
                const { data: fileList } = await supabaseAdmin.storage
                    .from("apelaciones")
                    .list(appeal.docs_url.replace("apelaciones/", ""))

                if (fileList && fileList.length > 0) {
                    // Generate signed URLs for each file
                    files = await Promise.all(fileList.map(async (file) => {
                        const filePath = `${appeal.docs_url.replace("apelaciones/", "")}/${file.name}`

                        // Get signed URL (valid for 1 hour)
                        const { data: signedUrlData } = await supabaseAdmin.storage
                            .from("apelaciones")
                            .createSignedUrl(filePath, 3600)

                        // Detect if file is an image
                        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']
                        const isImage = imageExtensions.some(ext =>
                            file.name.toLowerCase().endsWith(ext)
                        )

                        return {
                            name: file.name,
                            path: `${appeal.docs_url}/${file.name}`,
                            url: signedUrlData?.signedUrl || null,
                            size: file.metadata?.size || 0,
                            isImage
                        }
                    }))
                }
            } catch (storageError) {
                console.error("Error fetching files:", storageError)
            }
        }

        return NextResponse.json({ ...appeal, files })

    } catch (error) {
        console.error("Error in GET appeal:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}

export async function PATCH(request, context) {
    try {
        const user = await getUserFromRequest(request)

        if (!user) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        // Only HR can update appeals
        const canUpdateAppeals = ["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "JEFE"].includes(user.rol)

        if (!canUpdateAppeals) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const params = await context.params
        const { id } = params
        const body = await request.json()
        const { estado } = body

        if (!estado || !["APROBADA", "RECHAZADA"].includes(estado)) {
            return NextResponse.json({ message: "Estado inválido" }, { status: 400 })
        }

        // Update appeal status
        const { data: updatedAppeal, error } = await supabase
            .from("apelaciones")
            .update({ estado })
            .eq("id", id)
            .select()
            .single()

        if (error) {
            console.error("Error updating appeal:", error)
            return NextResponse.json({
                message: `Error al actualizar apelación: ${error.message}`
            }, { status: 500 })
        }

        return NextResponse.json({
            message: `Apelación ${estado.toLowerCase()} exitosamente`,
            appeal: updatedAppeal
        })

    } catch (error) {
        console.error("Error in PATCH appeal:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
