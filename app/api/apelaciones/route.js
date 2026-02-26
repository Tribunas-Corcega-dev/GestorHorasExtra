import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logAudit } from "@/lib/logger"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

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

    const jornada = await prisma.jornadas.findUnique({
      where: { id: jornadaId },
      select: { empleado_id: true },
    })

    if (!jornada) {
      return NextResponse.json({ message: "Jornada no encontrada" }, { status: 404 })
    }

    if (jornada.empleado_id !== user.id) {
      return NextResponse.json({ message: "No autorizado para apelar esta jornada" }, { status: 403 })
    }

    const currentDate = new Date().toISOString().split("T")[0]
    const folderPath = `${currentDate}/${user.cc}`
    let docsUrl = null

    if (files && files.length > 0 && files[0].size > 0) {
      for (const file of files) {
        const fileName = file.name
        const filePath = `${folderPath}/${fileName}`

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const { error: uploadError } = await supabaseAdmin.storage.from("apelaciones").upload(filePath, buffer, {
          contentType: file.type,
          upsert: true,
        })

        if (uploadError) {
          console.error("Error uploading file:", uploadError)
          return NextResponse.json({ message: `Error al subir archivo ${fileName}: ${uploadError.message}` }, { status: 500 })
        }
      }
      docsUrl = `apelaciones/${folderPath}`
    }

    const newApeal = await prisma.apelaciones.create({
      data: {
        empleado_id: user.id,
        jornada_id: jornadaId,
        fecha: new Date(`${currentDate}T00:00:00.000Z`),
        motivo,
        estado: "PENDIENTE",
        docs_url: docsUrl,
      },
    })

    await logAudit({
      action: "CREATE",
      entity: "APELACION",
      entityId: newApeal.id,
      details: {
        jornada_id: jornadaId,
        motivo,
        has_files: !!docsUrl,
      },
      user,
    })

    return NextResponse.json({ message: "Apelacion enviada exitosamente", appeal: newApeal }, { status: 201 })
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

    const canViewAppeals = ["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "JEFE", "COORDINADOR"].includes(user.rol)

    if (!canViewAppeals) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get("estado") || "PENDIENTE"

    const where = {}
    if (estado) where.estado = estado
    if (user.rol === "COORDINADOR") {
      where.usuarios = { area: user.area }
    }

    const appeals = await prisma.apelaciones.findMany({
      where,
      include: {
        usuarios: {
          select: { id: true, nombre: true, username: true, cc: true, foto_url: true, area: true },
        },
        jornadas: {
          select: { id: true, fecha: true, jornada_base_calcular: true, horas_extra_hhmm: true, es_festivo: true },
        },
      },
      orderBy: { fecha: "desc" },
    })

    return NextResponse.json(
      appeals.map((item) => ({
        ...item,
        empleado: item.usuarios,
        jornada: item.jornadas,
        usuarios: undefined,
        jornadas: undefined,
      }))
    )
  } catch (error) {
    console.error("Error in GET apelaciones:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
