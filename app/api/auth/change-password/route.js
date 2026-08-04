import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function POST(request) {
  try {
    const authUser = await getUserFromRequest(request)
    if (!authUser) {
      return NextResponse.json({ message: "No autorizado" }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { message: "Debes indicar la contraseña actual y la nueva" },
        { status: 400 },
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { message: "La nueva contraseña debe tener al menos 8 caracteres" },
        { status: 400 },
      )
    }

    // Volvemos a leer el usuario para tener el hash actual
    const user = await prisma.usuarios.findUnique({ where: { id: authUser.id } })
    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado" }, { status: 404 })
    }

    const isValid = await bcrypt.compare(currentPassword, user.password_hash)
    if (!isValid) {
      return NextResponse.json({ message: "La contraseña actual es incorrecta" }, { status: 401 })
    }

    const newHash = await bcrypt.hash(newPassword, 10)

    await prisma.usuarios.update({
      where: { id: user.id },
      data: { password_hash: newHash },
    })

    return NextResponse.json({ message: "Contraseña actualizada correctamente" })
  } catch (error) {
    console.error("[change-password] Error:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
