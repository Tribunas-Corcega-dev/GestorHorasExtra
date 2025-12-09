import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import bcrypt from "bcryptjs"
import { supabase } from "@/lib/supabaseClient"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { canManageEmployees, isCoordinator } from "@/lib/permissions"
import { calculateEmployeeWorkValues, calculateScheduleSurcharges } from "@/lib/calculations"

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



    const { id } = params

    const { data: empleado, error } = await supabase.from("usuarios").select("*").eq("id", id).single()

    if (error || !empleado) {
      return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 })
    }

    // Allow access if user has management permissions OR if they are requesting their own data
    if (!user || (!canManageEmployees(user.rol) && user.id !== id)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
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
    if (body.area !== undefined) {
      // Si es coordinador, no puede cambiar el área
      if (isCoordinator(user.rol)) {
        return NextResponse.json({ message: "No puedes cambiar el área de un empleado" }, { status: 403 })
      }
      updateData.area = body.area
    }
    if (body.rol !== undefined) updateData.rol = body.rol
    if (body.salario_base !== undefined) updateData.salario_base = body.salario_base
    if (body.minimo !== undefined) updateData.minimo = body.minimo

    // Handle Schedule Update with Surcharges
    if (body.jornada_fija_hhmm !== undefined) {
      let enrichedSchedule = body.jornada_fija_hhmm
      if (enrichedSchedule) {
        // Fetch Night Shift Parameters
        let nightShiftRange = { start: "21:00", end: "06:00" } // Default
        const { data: params } = await supabase.from("parametros").select("jornada_nocturna").single()
        if (params && params.jornada_nocturna) {
          nightShiftRange = params.jornada_nocturna
        }
        enrichedSchedule = calculateScheduleSurcharges(body.jornada_fija_hhmm, nightShiftRange)
      }
      updateData.jornada_fija_hhmm = enrichedSchedule
    }

    if (body.foto_url !== undefined) updateData.foto_url = body.foto_url

    // Note: 'cc' is read-only, so we don't update it here.

    // Recalculate work values if schedule or salary changes
    if (body.jornada_fija_hhmm !== undefined || body.salario_base !== undefined) {
      const scheduleToUse = updateData.jornada_fija_hhmm !== undefined ? updateData.jornada_fija_hhmm : currentEmpleado.jornada_fija_hhmm
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
      .select("id, username, nombre, cc, foto_url, area, rol, salario_base, jornada_fija_hhmm, minimo")
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

export async function DELETE(request, props) {
  try {
    const params = await props.params
    const user = await getUserFromRequest(request)

    // Only HR/Admin can delete employees (not coordinators)
    if (!user || !canManageEmployees(user.rol) || isCoordinator(user.rol)) {
      return NextResponse.json({ message: "No autorizado" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json({ message: "Se requiere contraseña para eliminar" }, { status: 400 })
    }

    // Verify the logged-in user's password
    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatch) {
      return NextResponse.json({ message: "Contraseña incorrecta" }, { status: 401 })
    }

    // Check if employee exists and get cc for photo deletion
    const { data: empleado, error: fetchError } = await supabase
      .from("usuarios")
      .select("id, cc")
      .eq("id", id)
      .single()

    if (fetchError || !empleado) {
      return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 })
    }

    // Delete employee's photo folder from storage if they have a cc
    if (empleado.cc && supabaseAdmin) {
      try {
        const { data: files } = await supabaseAdmin.storage
          .from("fotos_trabajadores")
          .list(empleado.cc)

        if (files && files.length > 0) {
          const filesToRemove = files.map(f => `${empleado.cc}/${f.name}`)
          const { error: removeError } = await supabaseAdmin.storage
            .from("fotos_trabajadores")
            .remove(filesToRemove)

          if (removeError) {
            console.error("[v0] Error removing files:", removeError)
          }
        }
      } catch (storageError) {
        console.error("[v0] Error deleting employee photos:", storageError)
        // Continue with employee deletion even if photo deletion fails
      }
    }

    // Delete the employee
    const { error: deleteError } = await supabase
      .from("usuarios")
      .delete()
      .eq("id", id)

    if (deleteError) {
      console.error("[v0] Error deleting employee:", deleteError)
      return NextResponse.json({ message: `Error al eliminar el empleado: ${deleteError.message}` }, { status: 500 })
    }

    return NextResponse.json({ message: "Empleado eliminado exitosamente" })
  } catch (error) {
    console.error("[v0] Error in DELETE empleado:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
