import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { canManageEmployees, isCoordinator } from "@/lib/permissions"
import { calculateEmployeeWorkValues, calculateScheduleSurcharges } from "@/lib/calculations"
import { logAudit } from "@/lib/logger"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(request, props) {
  try {
    const params = await props.params
    const user = await getUserFromRequest(request)
    const { id } = params

    const empleado = await prisma.usuarios.findUnique({ where: { id } })

    if (!empleado) {
      return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 })
    }

    if (!user || (!canManageEmployees(user.rol) && user.id !== id)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    if (isCoordinator(user.rol) && empleado.area !== user.area) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const { password_hash, ...empleadoSafe } = empleado

    return NextResponse.json(empleadoSafe)
  } catch (error) {
    console.error("[v0] Error in GET empleado:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

export async function PUT(request, props) {
  try {
    const params = await props.params
    const user = await getUserFromRequest(request)

    if (!user || !canManageEmployees(user.rol)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()

    const currentEmpleado = await prisma.usuarios.findUnique({ where: { id } })

    if (!currentEmpleado) {
      return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 })
    }

    if (isCoordinator(user.rol) && currentEmpleado.area !== user.area) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const updateData = {}

    if (body.nombre !== undefined) updateData.nombre = body.nombre
    if (body.area !== undefined) {
      if (isCoordinator(user.rol)) {
        return NextResponse.json({ message: "No puedes cambiar el area de un empleado" }, { status: 403 })
      }
      updateData.area = body.area
    }
    if (body.rol !== undefined) updateData.rol = body.rol
    if (body.salario_base !== undefined) updateData.salario_base = body.salario_base
    if (body.minimo !== undefined) updateData.minimo = body.minimo

    if (body.jornada_fija_hhmm !== undefined) {
      let enrichedSchedule = body.jornada_fija_hhmm
      if (enrichedSchedule) {
        let nightShiftRange = { start: "21:00", end: "06:00" }
        const params = await prisma.parametros.findFirst({
          select: { jornada_nocturna: true },
        })
        if (params?.jornada_nocturna) {
          nightShiftRange = params.jornada_nocturna
        }
        enrichedSchedule = calculateScheduleSurcharges(body.jornada_fija_hhmm, nightShiftRange)
      }
      updateData.jornada_fija_hhmm = enrichedSchedule
    }

    if (body.foto_url !== undefined) updateData.foto_url = body.foto_url

    if (body.jornada_fija_hhmm !== undefined || body.salario_base !== undefined) {
      const scheduleToUse = updateData.jornada_fija_hhmm !== undefined ? updateData.jornada_fija_hhmm : currentEmpleado.jornada_fija_hhmm
      const salaryToUse = body.salario_base !== undefined ? body.salario_base : currentEmpleado.salario_base

      const { horas_semanales, horas_mensuales, valor_hora } = calculateEmployeeWorkValues(scheduleToUse, salaryToUse)

      updateData.horas_semanales = horas_semanales
      updateData.horas_mensuales = horas_mensuales
      updateData.valor_hora = valor_hora

      const historyToUpdate = [...(currentEmpleado.hist_salarios || [])]

      if (historyToUpdate.length === 0) {
        historyToUpdate.push({
          date: "2000-01-01T00:00:00.000Z",
          salary: currentEmpleado.salario_base,
          hourlyRate: Number(currentEmpleado.valor_hora),
          reason: "Linea base inicial",
        })
      }

      const newEntry = {
        date: body.fecha_cambio || new Date().toISOString(),
        salary: salaryToUse,
        hourlyRate: valor_hora,
        reason: "Actualizacion individual",
      }
      updateData.hist_salarios = [...historyToUpdate, newEntry]
    }

    if (body.password) {
      if (body.password.length < 8) {
        return NextResponse.json({ message: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 })
      }
      updateData.password_hash = await bcrypt.hash(body.password, 10)
    }

    const updatedEmpleado = await prisma.usuarios.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        nombre: true,
        cc: true,
        foto_url: true,
        area: true,
        rol: true,
        salario_base: true,
        jornada_fija_hhmm: true,
        minimo: true,
      },
    })

    if (updateData.valor_hora !== undefined && body.fecha_cambio) {
      const effectiveDate = formatToDateString(body.fecha_cambio)
      if (effectiveDate) {
        await prisma.jornadas.updateMany({
          where: {
            empleado_id: id,
            fecha: { gte: new Date(`${effectiveDate}T00:00:00.000Z`) },
          },
          data: { valor_hora_snapshot: updateData.valor_hora },
        })
      }
    }

    const changes = {}
    Object.keys(updateData).forEach((key) => {
      if (key === "hist_salarios") return

      if (JSON.stringify(updateData[key]) !== JSON.stringify(currentEmpleado[key])) {
        changes[key] = { old: currentEmpleado[key], new: updateData[key] }
      }
    })

    if (body.password) {
      changes.password = { old: "******", new: "******" }
    }

    if (Object.keys(changes).length > 0) {
      await logAudit({
        action: "UPDATE",
        entity: "EMPLEADO",
        entityId: id,
        details: { diff: changes },
        user,
      })
    }

    return NextResponse.json(updatedEmpleado)
  } catch (error) {
    console.error("[v0] Error in PUT empleado:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}

function formatToDateString(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toISOString().split("T")[0]
}

export async function DELETE(request, props) {
  try {
    const params = await props.params
    const user = await getUserFromRequest(request)

    if (!user || !canManageEmployees(user.rol) || isCoordinator(user.rol)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json({ message: "Se requiere contraseña para eliminar" }, { status: 400 })
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      return NextResponse.json({ message: "Contraseña incorrecta" }, { status: 401 })
    }

    const empleado = await prisma.usuarios.findUnique({
      where: { id },
      select: { id: true, cc: true },
    })

    if (!empleado) {
      return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 })
    }

    await prisma.usuarios.update({
      where: { id },
      data: { is_active: false },
    })

    await logAudit({
      action: "DELETE",
      entity: "EMPLEADO",
      entityId: id,
      details: { reason: "Soft Delete (Deactivation)", cc: empleado.cc },
      user,
    })

    return NextResponse.json({ message: "Empleado desactivado exitosamente. Su historial se preservara." })
  } catch (error) {
    console.error("[v0] Error in DELETE empleado:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
