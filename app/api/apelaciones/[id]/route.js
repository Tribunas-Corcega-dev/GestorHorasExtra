import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logAudit } from "@/lib/logger"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(request, context) {
  try {
    const user = await getUserFromRequest(request)

    if (!user) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const canViewAppeals = ["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "JEFE", "COORDINADOR"].includes(user.rol)

    if (!canViewAppeals) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const params = await context.params
    const { id } = params

    const appeal = await prisma.apelaciones.findUnique({
      where: { id },
      include: {
        usuarios: {
          select: { id: true, nombre: true, username: true, cc: true, foto_url: true, area: true, valor_hora: true },
        },
        jornadas: {
          select: { id: true, fecha: true, jornada_base_calcular: true, horas_extra_hhmm: true, es_festivo: true },
        },
      },
    })

    if (!appeal) {
      return NextResponse.json({ message: "Apelacion no encontrada" }, { status: 404 })
    }

    let files = []
    if (appeal.docs_url) {
      try {
        const { data: fileList } = await supabaseAdmin.storage.from("apelaciones").list(appeal.docs_url.replace("apelaciones/", ""))

        if (fileList && fileList.length > 0) {
          files = await Promise.all(
            fileList.map(async (file) => {
              const filePath = `${appeal.docs_url.replace("apelaciones/", "")}/${file.name}`
              const { data: signedUrlData } = await supabaseAdmin.storage.from("apelaciones").createSignedUrl(filePath, 3600)

              const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"]
              const isImage = imageExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))

              return {
                name: file.name,
                path: `${appeal.docs_url}/${file.name}`,
                url: signedUrlData?.signedUrl || null,
                size: file.metadata?.size || 0,
                isImage,
              }
            })
          )
        }
      } catch (storageError) {
        console.error("Error fetching files:", storageError)
      }
    }

    return NextResponse.json({
      ...appeal,
      empleado: appeal.usuarios,
      jornada: appeal.jornadas,
      usuarios: undefined,
      jornadas: undefined,
      files,
    })
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

    const canUpdateAppeals = ["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "JEFE", "COORDINADOR"].includes(user.rol)

    if (!canUpdateAppeals) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const params = await context.params
    const { id } = params
    const body = await request.json()
    const { estado } = body

    if (!estado || !["APROBADA", "RECHAZADA"].includes(estado)) {
      return NextResponse.json({ message: "Estado invalido" }, { status: 400 })
    }

    const updatedAppeal = await prisma.apelaciones.update({
      where: { id },
      data: { estado },
    })

    await logAudit({
      action: estado === "APROBADA" ? "APPROVE" : "REJECT",
      entity: "APELACION",
      entityId: id,
      details: {
        new_status: estado,
        user_role: user.rol,
      },
      user,
    })

    return NextResponse.json({
      message: `Apelacion ${estado.toLowerCase()} exitosamente`,
      appeal: updatedAppeal,
    })
  } catch (error) {
    console.error("Error in PATCH appeal:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
