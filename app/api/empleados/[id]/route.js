import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import { supabase } from "@/lib/supabaseClient"
import { canManageEmployees, isCoordinator } from "@/lib/permissions"
import { calculateEmployeeWorkValues } from "@/lib/calculations"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

async function getUserFromRequest(request) {
  const token = request.cookies.get("auth_token")?.value
  if (!token) return null

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const { data: user } = await supabase.from("usuarios").select("*").eq("id", decoded.id).single()
    return user
  } catch {
    return null
  }
}

export async function GET(request, props) {
  try {
    const params = await props.params
    const user = await getUserFromRequest(request)

    if (!user || !canManageEmployees(user.rol)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const { id } = params

    const { data: empleado, error } = await supabase.from("usuarios").select("*").eq("id", id).single()

    if (error || !empleado) {
      return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 })
    }

    // Si es coordinador, solo puede ver empleados de su área
    if (isCoordinator(user.rol) && empleado.area !== user.area) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    // No devolver password_hash
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

    // Obtener empleado actual
    const { data: currentEmpleado, error: fetchError } = await supabase
      .from("usuarios")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError || !currentEmpleado) {
      return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 })
    }

    // Si es coordinador, solo puede editar empleados de su área
    if (isCoordinator(user.rol) && currentEmpleado.area !== user.area) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    // Preparar datos a actualizar
    const updateData = {}

    if (body.nombre !== undefined) updateData.nombre = body.nombre
    if (body.cargo !== undefined) updateData.cargo = body.cargo
    if (body.area !== undefined) {
      // Si es coordinador, no puede cambiar el área
      if (isCoordinator(user.rol)) {
        return NextResponse.json({ message: "No puedes cambiar el área de un empleado" }, { status: 403 })
      }
      updateData.area = body.area
    }
    if (body.rol !== undefined) updateData.rol = body.rol
    if (body.tipo_trabajador !== undefined) updateData.tipo_trabajador = body.tipo_trabajador
    if (body.salario_base !== undefined) updateData.salario_base = body.salario_base
    if (body.jornada_fija_hhmm !== undefined) updateData.jornada_fija_hhmm = body.jornada_fija_hhmm

    // Note: 'cc' is read-only, so we don't update it here.

    // Recalculate work values if schedule or salary changes
    if (body.jornada_fija_hhmm !== undefined || body.salario_base !== undefined) {
      const scheduleToUse = body.jornada_fija_hhmm !== undefined ? body.jornada_fija_hhmm : currentEmpleado.jornada_fija_hhmm
      const salaryToUse = body.salario_base !== undefined ? body.salario_base : currentEmpleado.salario_base

      const { horas_semanales, horas_mensuales, valor_hora } = calculateEmployeeWorkValues(scheduleToUse, salaryToUse)

      updateData.horas_semanales = horas_semanales
      updateData.horas_mensuales = horas_mensuales
      updateData.valor_hora = valor_hora
    }

    // Si se proporciona nueva contraseña
    if (body.password) {
      if (body.password.length < 8) {
        return NextResponse.json({ message: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 })
      }
      updateData.password_hash = await bcrypt.hash(body.password, 10)
    }

    // Actualizar empleado
    const { data: updatedEmpleado, error: updateError } = await supabase
      .from("usuarios")
      .update(updateData)
      .eq("id", id)
      .select("id, username, nombre, cc, cargo, area, rol, tipo_trabajador, salario_base, jornada_fija_hhmm")
      .single()

    if (updateError) {
      console.error("[v0] Error updating employee:", updateError)
      return NextResponse.json({ message: `Error al actualizar el empleado: ${updateError.message}` }, { status: 500 })
    }

    return NextResponse.json(updatedEmpleado)
  } catch (error) {
    console.error("[v0] Error in PUT empleado:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
