import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { canManageEmployees, isCoordinator } from "@/lib/permissions"
import { calculateEmployeeWorkValues, calculateScheduleSurcharges } from "@/lib/calculations"
import { logAudit } from "@/lib/logger"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request)

    if (!user || !canManageEmployees(user.rol)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const area = searchParams.get("area") || ""
    const rol = searchParams.get("rol") || ""

    const where = {
      is_active: true,
    }

    // Si es coordinador, solo puede ver empleados de su área
    if (isCoordinator(user.rol)) {
      where.area = user.area
    }

    // Filtros
    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { nombre: { contains: search, mode: "insensitive" } },
      ]
    }

    if (area) {
      where.area = area
    }

    if (rol) {
      where.rol = rol
    }

    const empleados = await prisma.usuarios.findMany({
      where,
      select: {
        id: true,
        username: true,
        nombre: true,
        cc: true,
        foto_url: true,
        area: true,
        rol: true,
        salario_base: true,
        jornada_fija_hhmm: true,
      },
    })

    return NextResponse.json(empleados)
  } catch (error) {
    console.error("[v0] Error in GET empleados:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request)

    if (!user || !canManageEmployees(user.rol)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const body = await request.json()
    const { username, password, nombre, cc, foto_url, area, rol, salario_base, jornada_fija_hhmm } = body

    // Validaciones
    if (!username || !password || !cc) {
      return NextResponse.json({ message: "Username, contraseña y cédula son obligatorios" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ message: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 })
    }

    // Si es coordinador, solo puede crear empleados en su área
    if (isCoordinator(user.rol) && area !== user.area) {
      return NextResponse.json({ message: "No puedes crear empleados fuera de tu área" }, { status: 403 })
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.usuarios.findUnique({
      where: { username },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json({ message: "El username ya existe" }, { status: 400 })
    }

    // Verificar si la cédula ya existe
    const existingCC = await prisma.usuarios.findFirst({
      where: { cc },
      select: { id: true },
    })

    if (existingCC) {
      return NextResponse.json({ message: "La cédula ya está registrada" }, { status: 400 })
    }

    // Generar hash de la contraseña
    const password_hash = await bcrypt.hash(password, 10)

    // Calculate Schedule Surcharges
    let enrichedSchedule = jornada_fija_hhmm
    if (jornada_fija_hhmm) {
      // Fetch Night Shift Parameters
      let nightShiftRange = { start: "21:00", end: "06:00" } // Default
      const currentYear = new Date().getFullYear().toString()

      let params = await prisma.parametros.findFirst({
        where: { anio_vigencia: currentYear },
        select: { jornada_nocturna: true },
      })

      if (!params) {
        params = await prisma.parametros.findFirst({
          select: { jornada_nocturna: true },
          orderBy: { anio_vigencia: "desc" },
        })
      }

      if (params && params.jornada_nocturna) {
        nightShiftRange = params.jornada_nocturna
      }
      enrichedSchedule = calculateScheduleSurcharges(jornada_fija_hhmm, nightShiftRange)
    }

    // Calculate work values
    const { horas_semanales, horas_mensuales, valor_hora } = calculateEmployeeWorkValues(enrichedSchedule, salario_base)

    // Insertar nuevo usuario
    const newUser = await prisma.usuarios.create({
      data: {
        username,
        password_hash,
        nombre: nombre || null,
        cc: cc || null,
        foto_url: foto_url || null,
        area: area || null,
        rol: rol || "OPERARIO",
        salario_base: salario_base || null,
        jornada_fija_hhmm: enrichedSchedule || null,
        horas_semanales,
        horas_mensuales,
        valor_hora,
      },
      select: {
        id: true,
        username: true,
        nombre: true,
        cc: true,
        foto_url: true,
        area: true,
        rol: true,
        salario_base: true,
        jornada_fija_hhmm: true,
      },
    })

    // Audit Log
    await logAudit({
      action: "CREATE",
      entity: "EMPLEADO",
      entityId: newUser.id,
      details: {
        nombre: newUser.nombre,
        cc: newUser.cc,
        area: newUser.area,
        rol: newUser.rol,
        salario_base: newUser.salario_base
      },
      user: user
    })

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    console.error("[v0] Error in POST empleados:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
