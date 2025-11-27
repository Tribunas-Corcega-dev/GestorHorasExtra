import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import { supabase } from "@/lib/supabaseClient"
import { canManageEmployees, isCoordinator } from "@/lib/permissions"
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

    if (!user || !canManageEmployees(user.rol)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const area = searchParams.get("area") || ""
    const rol = searchParams.get("rol") || ""

    let query = supabase
      .from("usuarios")
      .select("id, username, nombre, cc, foto_url, area, rol, salario_base, jornada_fija_hhmm")

    // Si es coordinador, solo puede ver empleados de su área
    if (isCoordinator(user.rol)) {
      query = query.eq("area", user.area)
    }

    // Filtros
    if (search) {
      query = query.or(`username.ilike.%${search}%,nombre.ilike.%${search}%`)
    }

    if (area) {
      query = query.eq("area", area)
    }

    if (rol) {
      query = query.eq("rol", rol)
    }

    const { data: empleados, error } = await query

    if (error) {
      console.error("[v0] Error fetching employees:", error)
      return NextResponse.json({ message: "Error al obtener empleados" }, { status: 500 })
    }

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
    const { data: existingUser } = await supabase.from("usuarios").select("id").eq("username", username).single()

    if (existingUser) {
      return NextResponse.json({ message: "El username ya existe" }, { status: 400 })
    }

    // Verificar si la cédula ya existe
    const { data: existingCC } = await supabase.from("usuarios").select("id").eq("cc", cc).single()

    if (existingCC) {
      return NextResponse.json({ message: "La cédula ya está registrada" }, { status: 400 })
    }

    // Generar hash de la contraseña
    const password_hash = await bcrypt.hash(password, 10)

    // Calculate work values
    const { horas_semanales, horas_mensuales, valor_hora } = calculateEmployeeWorkValues(jornada_fija_hhmm, salario_base)

    // Insertar nuevo usuario
    const { data: newUser, error } = await supabase
      .from("usuarios")
      .insert([
        {
          username,
          password_hash,
          nombre: nombre || null,
          cc: cc || null,
          foto_url: foto_url || null,
          area: area || null,
          rol: rol || "OPERARIO",
          salario_base: salario_base || null,
          jornada_fija_hhmm: jornada_fija_hhmm || null,
          horas_semanales,
          horas_mensuales,
          valor_hora
        },
      ])
      .select("id, username, nombre, cc, foto_url, area, rol, salario_base, jornada_fija_hhmm")
      .single()

    if (error) {
      console.error("[v0] Error creating employee:", error)
      return NextResponse.json({ message: "Error al crear el empleado" }, { status: 500 })
    }

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    console.error("[v0] Error in POST empleados:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
