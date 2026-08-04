import { NextResponse } from "next/server"
import { canManageOvertime } from "@/lib/permissions"
import { logAudit } from "@/lib/logger"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function POST(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user || !canManageOvertime(user.rol)) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const body = await request.json()
        const { jornada_id, empleado_id, fecha, jornada_base_calcular, horas_extra_hhmm, es_festivo, observaciones } = body

        if (!empleado_id || !fecha || !jornada_base_calcular) {
            return NextResponse.json({ message: "Faltan datos requeridos" }, { status: 400 })
        }

        const fechaDate = parseDateOnly(fecha)
        if (!fechaDate) {
            return NextResponse.json({ message: "Fecha inválida" }, { status: 400 })
        }

        const empleado = await prisma.usuarios.findUnique({
            where: { id: empleado_id },
            select: { valor_hora: true }
        })

        if (!empleado) {
            return NextResponse.json({ message: "Empleado no encontrado" }, { status: 404 })
        }

        const newJornada = await prisma.jornadas.create({
            data: {
                empleado_id,
                fecha: fechaDate,
                jornada_base_calcular,
                horas_extra_hhmm: horas_extra_hhmm || {},
                es_festivo: es_festivo || false,
                observaciones: observaciones || "",
                registrado_por: user.id,
                valor_hora_snapshot: empleado.valor_hora,
            }
        })

        // Audit Log
        await logAudit({
            action: "CREATE",
            entity: "JORNADA",
            entityId: newJornada.id,
            details: {
                fecha: newJornada.fecha,
                empleado_id: newJornada.empleado_id,
                horas: newJornada.horas_extra_hhmm,
                es_festivo: newJornada.es_festivo,
                observaciones: newJornada.observaciones,
                snapshot_valor_hora: newJornada.valor_hora_snapshot
            },
            user: user
        })

        return NextResponse.json(serializeJornada(newJornada), { status: 201 })
    } catch (error) {
        console.error("[v0] Error in POST jornadas:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}

export async function PUT(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user || !canManageOvertime(user.rol)) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const body = await request.json()
        const { jornada_id, empleado_id, fecha, jornada_base_calcular, horas_extra_hhmm, es_festivo, observaciones } = body

        if (!jornada_id && (!empleado_id || !fecha)) {
            return NextResponse.json({ message: "Faltan datos requeridos (jornada_id o empleado_id+fecha)" }, { status: 400 })
        }

        let existingJornada = null

        if (jornada_id) {
            existingJornada = await prisma.jornadas.findUnique({
                where: { id: jornada_id },
                select: { id: true, empleado_id: true }
            })

            if (!existingJornada) {
                return NextResponse.json({ message: "Jornada no encontrada" }, { status: 404 })
            }

            if (empleado_id && existingJornada.empleado_id !== empleado_id) {
                return NextResponse.json({ message: "La jornada no pertenece al empleado indicado" }, { status: 400 })
            }
        } else {
            const fechaDate = parseDateOnly(fecha)
            if (!fechaDate) {
                return NextResponse.json({ message: "Fecha inválida" }, { status: 400 })
            }

            existingJornada = await prisma.jornadas.findFirst({
                where: {
                    empleado_id,
                    fecha: fechaDate,
                },
                select: { id: true }
            })

            if (!existingJornada) {
                return NextResponse.json({ message: "Jornada no encontrada" }, { status: 404 })
            }
        }
        const updatedJornada = await prisma.jornadas.update({
            where: { id: existingJornada.id },
            data: {
                jornada_base_calcular,
                horas_extra_hhmm: horas_extra_hhmm || {},
                es_festivo: es_festivo || false,
                observaciones: observaciones || "",
            }
        })

        // Audit Log
        await logAudit({
            action: "UPDATE",
            entity: "JORNADA",
            entityId: updatedJornada.id,
            details: {
                fecha: updatedJornada.fecha,
                empleado_id: updatedJornada.empleado_id,
                new_horas: updatedJornada.horas_extra_hhmm,
                new_observaciones: updatedJornada.observaciones,
                es_festivo: updatedJornada.es_festivo
            },
            user: user
        })

        return NextResponse.json(serializeJornada(updatedJornada))
    } catch (error) {
        console.error("[v0] Error in PUT jornadas:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}

export async function GET(request) {
    try {
        const user = await getUserFromRequest(request)

        const { searchParams } = new URL(request.url)
        const empleado_id = searchParams.get("empleado_id")

        // Allow access if user has management permissions OR if they are requesting their own data
        if (!user || (!canManageOvertime(user.rol) && user.id !== empleado_id)) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const jornadas = await prisma.jornadas.findMany({
            where: empleado_id ? { empleado_id } : undefined,
            orderBy: { fecha: "desc" }
        })

        // Fetch user details for registrado_por and aprobado_por
        const userIds = new Set()
        jornadas.forEach(j => {
            if (j.registrado_por) userIds.add(j.registrado_por)
            if (j.aprobado_por) userIds.add(j.aprobado_por)
        })

        const normalizedJornadas = jornadas.map(serializeJornada)

        if (userIds.size > 0) {
            const users = await prisma.usuarios.findMany({
                where: { id: { in: Array.from(userIds) } },
                select: { id: true, nombre: true, username: true }
            })

            const userMap = {}
            users?.forEach(u => userMap[u.id] = u)

            // Attach user objects to jornadas
            const jornadasWithUsers = normalizedJornadas.map(j => ({
                ...j,
                registrador: j.registrado_por ? userMap[j.registrado_por] : null,
                aprobador: j.aprobado_por ? userMap[j.aprobado_por] : null
            }))

            return NextResponse.json(jornadasWithUsers)
        }

        return NextResponse.json(normalizedJornadas)
    } catch (error) {
        console.error("[v0] Error in GET jornadas:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}

function formatToDateString(dateValue) {
    if (!dateValue) return null
    return new Date(dateValue).toISOString().split('T')[0]
}

function parseDateOnly(value) {
    if (!value || typeof value !== "string") return null
    const dateOnly = value.includes("T") ? value.split("T")[0] : value
    const parsed = new Date(`${dateOnly}T00:00:00.000Z`)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
}

function serializeJornada(jornada) {
    if (!jornada) return jornada
    return {
        ...jornada,
        fecha: formatToDateString(jornada.fecha),
        valor_hora_snapshot:
            jornada.valor_hora_snapshot !== null && jornada.valor_hora_snapshot !== undefined
                ? Number(jornada.valor_hora_snapshot)
                : jornada.valor_hora_snapshot,
    }
}

export async function DELETE(request) {
    try {
        const user = await getUserFromRequest(request)

        if (!user || !canManageOvertime(user.rol)) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const empleado_id = searchParams.get("empleado_id")
        const fecha = searchParams.get("fecha")

        if (!empleado_id || !fecha) {
            return NextResponse.json({ message: "Faltan datos requeridos (empleado_id, fecha)" }, { status: 400 })
        }

        const fechaDate = parseDateOnly(fecha)
        if (!fechaDate) {
            return NextResponse.json({ message: "Fecha inválida" }, { status: 400 })
        }

        // Verificar si ya fue procesada en compensación antes de permitir el borrado
        const jornadasExistentes = await prisma.jornadas.findMany({
            where: {
                empleado_id,
                fecha: fechaDate,
            },
            select: {
                id: true,
                estado_compensacion: true,
            }
        })

        if (jornadasExistentes.length === 0) {
            return NextResponse.json({ message: "No se encontró el registro a eliminar" }, { status: 404 })
        }

        const yaProcesada = jornadasExistentes.some(
            (j) => j.estado_compensacion === "APROBADO" || j.estado_compensacion === "SOLICITADO"
        )

        if (yaProcesada) {
            return NextResponse.json(
                {
                    message: "No se puede eliminar: este registro ya fue procesado en compensación en tiempo. Si necesitas corregirlo, primero debe revertirse el movimiento en la bolsa de compensación."
                },
                { status: 409 }
            )
        }

        await prisma.jornadas.deleteMany({
            where: {
                empleado_id,
                fecha: fechaDate,
            }
        })

        // Audit Log
        await logAudit({
            action: "DELETE",
            entity: "JORNADA",
            entityId: `${empleado_id}_${fecha}`,
            details: {
                fecha: fecha,
                empleado_id: empleado_id
            },
            user: user
        })

        return NextResponse.json({ message: "Jornada eliminada exitosamente" })
    } catch (error) {
        console.error("[v0] Error in DELETE jornadas:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
