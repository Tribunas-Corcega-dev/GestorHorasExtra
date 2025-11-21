import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { supabase } from "@/lib/supabaseClient"

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
    const { data: existingUser } = await supabase.from("usuarios").select("id").eq("username", username).single()

    if (existingUser) {
      return NextResponse.json({ message: "El username ya existe" }, { status: 400 })
    }

    // Generar hash de la contraseña
    const password_hash = await bcrypt.hash(password, 10)

    // Insertar nuevo usuario
    const { data: newUser, error } = await supabase
      .from("usuarios")
      .insert([
        {
          username,
          password_hash,
          nombre: nombre || null,
          cargo: cargo || null,
          area: area || null,
          rol: rol || "OPERARIO",
          tipo_trabajador: tipo_trabajador || null,
          salario_base: salario_base || null,
          jornada_fija_hhmm: jornada_fija_hhmm || null,
        },
      ])
      .select("id, username, nombre, cargo, area, rol")
      .single()

    if (error) {
      console.error("[v0] Error creating user:", error)
      return NextResponse.json({ message: "Error al crear el usuario" }, { status: 500 })
    }

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    console.error("[v0] Error in register:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
