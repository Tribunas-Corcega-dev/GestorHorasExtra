import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(request) {
  try {
    const { username, password, nombre, cargo, area, rol, tipo_trabajador, salario_base, jornada_fija_hhmm } =
      await request.json()

    // Validaciones
    if (!username || !password) {
      return NextResponse.json({ message: "Username y contraseña son obligatorios" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ message: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 })
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.usuarios.findUnique({ where: { username } })

    if (existingUser) {
      return NextResponse.json({ message: "El username ya existe" }, { status: 400 })
    }

    // Generar hash de la contraseña
    const password_hash = await bcrypt.hash(password, 10)

    // Insertar nuevo usuario
    const newUser = await prisma.usuarios.create({
      data: {
        username,
        password_hash,
        nombre: nombre || null,
        area: area || null,
        rol: rol || "OPERARIO",
        salario_base: salario_base || null,
        jornada_fija_hhmm: jornada_fija_hhmm || null,
      },
      select: { id: true, username: true, nombre: true, area: true, rol: true },
    })

    return NextResponse.json({ ...newUser, cargo: cargo || null, tipo_trabajador: tipo_trabajador || null }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error in register:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
