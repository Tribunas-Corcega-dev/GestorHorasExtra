import { NextResponse } from "next/server"
import { getUserFromRequest } from "@/lib/apiAuth"
import { prisma } from "@/lib/prisma"

export async function GET(request) {
    try {
        const user = await getUserFromRequest(request)

        // Only HR and Admin (JEFE) can view audit logs
        if (!user || (user.rol !== "JEFE" && user.rol !== "TALENTO_HUMANO")) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "50")
        const entity = searchParams.get("entity") || ""
        const action = searchParams.get("action") || ""
        const startDate = searchParams.get("startDate") || ""
        const endDate = searchParams.get("endDate") || ""

        const offset = (page - 1) * limit

        const where = {}
        if (entity) where.entity = entity
        if (action) where.action = action
        if (startDate || endDate) {
            where.created_at = {}
            if (startDate) where.created_at.gte = new Date(startDate)
            if (endDate) where.created_at.lte = new Date(endDate)
        }

        const [logs, count] = await Promise.all([
            prisma.audit_logs.findMany({
                where,
                orderBy: { created_at: "desc" },
                skip: offset,
                take: limit,
            }),
            prisma.audit_logs.count({ where }),
        ])

        // Fetch user directory for resolving IDs in frontend
        const users = await prisma.usuarios.findMany({
            select: { id: true, nombre: true, username: true }
        })

        const userDirectory = {}
        users?.forEach(u => {
            userDirectory[u.id] = u.nombre || u.username
        })

        return NextResponse.json({
            logs,
            total: count,
            page,
            totalPages: Math.ceil(count / limit),
            userDirectory
        })
    } catch (error) {
        console.error("[Audit API] Exception:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
