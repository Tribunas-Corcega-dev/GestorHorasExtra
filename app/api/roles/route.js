import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
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
