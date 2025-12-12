import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

export async function POST(request) {
    try {
        // 1. Verificar autenticación
        const token = request.cookies.get("auth_token")?.value
        if (!token) {
            return NextResponse.json({ message: "No autenticado" }, { status: 401 })
        }

        try {
            jwt.verify(token, JWT_SECRET)
        } catch (error) {
            return NextResponse.json({ message: "Token inválido" }, { status: 401 })
        }

        // 2. Verificar configuración de Supabase Admin
        if (!supabaseAdmin) {
            console.error("Supabase Service Role Key missing")
            return NextResponse.json({
                message: "Error de configuración del servidor: Falta SUPABASE_SERVICE_ROLE_KEY"
            }, { status: 500 })
        }

        // 3. Procesar archivo
        const formData = await request.formData()
        const file = formData.get("file")
        const path = formData.get("path")

        if (!file || !path) {
            return NextResponse.json({ message: "Falta archivo o ruta" }, { status: 400 })
        }

        // Convertir File a ArrayBuffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // 3.5 Limpiar carpeta del usuario (Solo mantener la última foto)
        const folder = path.split('/')[0] // El path es "cc/filename"
        if (folder) {
            // Verificamos si existe la carpeta listando su contenido
            // Si la carpeta no existe (usuario creado sin foto), list devolverá vacío o error,
            // pero no debemos impedir la subida. La subida creará la carpeta automáticamente.
            const { data: existingFiles, error: listError } = await supabaseAdmin.storage
                .from("fotos_trabajadores")
                .list(folder)

            if (!listError && existingFiles && existingFiles.length > 0) {
                const filesToRemove = existingFiles.map(f => `${folder}/${f.name}`)
                const { error: removeError } = await supabaseAdmin.storage
                    .from("fotos_trabajadores")
                    .remove(filesToRemove)

                if (removeError) {
                    console.warn("Error cleaning up old photos:", removeError)
                }
            }
        }

        // 4. Subir a Supabase Storage (usando Service Role para bypass RLS)
        const { data, error } = await supabaseAdmin.storage
            .from("fotos_trabajadores")
            .upload(path, buffer, {
                contentType: file.type,
                upsert: true
            })

        if (error) {
            console.error("Supabase upload error:", error)
            if (error.message.includes("Bucket not found")) {
                return NextResponse.json({ message: "El bucket 'fotos_trabajadores' no existe" }, { status: 500 })
            }
            return NextResponse.json({ message: "Error al subir imagen: " + error.message }, { status: 500 })
        }

        // 5. Obtener URL pública
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from("fotos_trabajadores")
            .getPublicUrl(path)

        return NextResponse.json({ publicUrl })

    } catch (error) {
        console.error("Upload route error:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
