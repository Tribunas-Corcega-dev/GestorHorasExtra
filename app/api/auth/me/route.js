import { NextResponse } from "next/server"
import { getAuthPayloadFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(request) {
  try {
    const token = request.cookies.get("auth_token")?.value

    if (!token) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 })
    }

    const decoded = await getAuthPayloadFromRequest(request)
    if (!decoded) {
      return NextResponse.json({ message: "Token inválido o expirado" }, { status: 401 })
    }

    const user = await prisma.usuarios.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        nombre: true,
        area: true,
        rol: true,
      },
    })

    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 401 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("[v0] Error in me:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
