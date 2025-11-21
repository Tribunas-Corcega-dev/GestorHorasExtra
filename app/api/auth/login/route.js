import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabaseClient"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

export async function POST(request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ message: "Username y contraseña son obligatorios" }, { status: 400 })
    }

    // Buscar usuario por username
    const { data: user, error } = await supabase.from("usuarios").select("*").eq("username", username).single()

    if (error || !user) {
      return NextResponse.json({ message: "Usuario o contraseña incorrectos" }, { status: 401 })
    }

    // Verificar contraseña
    const isValid = await bcrypt.compare(password, user.password_hash)

    if (!isValid) {
      return NextResponse.json({ message: "Usuario o contraseña incorrectos" }, { status: 401 })
    }

    // Generar JWT
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        rol: user.rol,
        area: user.area,
      },
      JWT_SECRET,
      { expiresIn: "8h" },
    )

    // Crear respuesta con cookie
    const response = NextResponse.json({
      id: user.id,
      username: user.username,
      nombre: user.nombre,
      cargo: user.cargo,
      area: user.area,
      rol: user.rol,
    })

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 8, // 8 hours
      path: "/",
    })

    return response
  } catch (error) {
    console.error("[v0] Error in login:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
