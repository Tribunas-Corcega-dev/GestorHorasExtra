import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/apiAuth"
import { canManageEmployees } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || !canManageEmployees(user.rol)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const roles = await prisma.roles.findMany({
      select: { nombre: true },
      orderBy: { nombre: "asc" },
    })

    return NextResponse.json(roles.map((r) => r.nombre))
  } catch (error) {
    console.error("[v0] Error in GET roles:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}