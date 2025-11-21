import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabaseClient"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

export async function GET(request) {
  try {
    const token = request.cookies.get("auth_token")?.value

    if (!token) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 })
    }

    // Verificar token
    let decoded
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return NextResponse.json({ message: "Token inválido o expirado" }, { status: 401 })
    }

    // Obtener usuario actualizado de la base de datos
    const { data: user, error } = await supabase
      .from("usuarios")
      .select("id, username, nombre, cargo, area, rol")
      .eq("id", decoded.id)
      .single()

    if (error || !user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 401 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("[v0] Error in me:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
