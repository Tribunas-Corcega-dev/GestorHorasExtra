import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { calculateEmployeeWorkValues } from "@/lib/calculations"
import { appendSalaryHistoryEntry } from "@/lib/salaryHistory"
import { prisma } from "@/lib/prisma"

export async function POST(request) {
  try {
    const { username, password, nombre, cargo, area, rol, tipo_trabajador, salario_base, jornada_fija_hhmm } =
      await request.json()

    if (!username || !password) {
      return NextResponse.json({ message: "Username y contrasena son obligatorios" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ message: "La contrasena debe tener al menos 8 caracteres" }, { status: 400 })
    }

    const existingUser = await prisma.usuarios.findUnique({ where: { username } })

    if (existingUser) {
      return NextResponse.json({ message: "El username ya existe" }, { status: 400 })
    }

    const password_hash = await bcrypt.hash(password, 10)
    const workValues = calculateEmployeeWorkValues(jornada_fija_hhmm, salario_base)

    const newUser = await prisma.$transaction(async (tx) => {
      const created = await tx.usuarios.create({
        data: {
          username,
          password_hash,
          nombre: nombre || null,
          area: area || null,
          rol: rol || "OPERARIO",
          salario_base: salario_base || null,
          jornada_fija_hhmm: jornada_fija_hhmm || null,
          horas_semanales: workValues.horas_semanales,
          horas_mensuales: workValues.horas_mensuales,
          valor_hora: workValues.valor_hora,
        },
        select: { id: true, username: true, nombre: true, area: true, rol: true },
      })

      if (salario_base !== undefined && salario_base !== null) {
        await appendSalaryHistoryEntry(tx, {
          usuarioId: created.id,
          effectiveDate: new Date().toISOString(),
          salarioBase: salario_base,
          valorHora: workValues.valor_hora,
          horasSemanales: workValues.horas_semanales,
          horasMensuales: workValues.horas_mensuales,
          motivo: "Registro inicial",
          origen: "REGISTRO",
        })
      }

      return created
    })

    return NextResponse.json({ ...newUser, cargo: cargo || null, tipo_trabajador: tipo_trabajador || null }, { status: 201 })
  } catch (error) {
    console.error("[v0] Error in register:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
