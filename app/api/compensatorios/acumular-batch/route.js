import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { supabase } from "@/lib/supabaseClient"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

async function getUserFromRequest(request) {
    const token = request.cookies.get("auth_token")?.value
    if (!token) return null

    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        const client = supabaseAdmin || supabase
        const { data: user } = await client.from("usuarios").select("*").eq("id", decoded.id).single()
        return user
    } catch {
        return null
    }
}

export async function POST(request) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ message: "Error de configuración del servidor" }, { status: 500 })
        }

        const user = await getUserFromRequest(request)
        if (!user) {
            return NextResponse.json({ message: "No autorizado" }, { status: 401 })
        }

        const body = await request.json()
        const { requests } = body

        if (!requests || Object.keys(requests).length === 0) {
            return NextResponse.json({ message: "No se enviaron datos para procesar" }, { status: 400 })
        }

        const threeMonthsAgo = new Date()
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

        const { data: jornadas, error: jornadasError } = await supabaseAdmin
            .from("jornadas")
            .select("*")
            .eq("empleado_id", user.id)
            .gte("fecha", threeMonthsAgo.toISOString().split('T')[0])
            .order("fecha", { ascending: true })

        if (jornadasError) throw jornadasError

        let totalProcessedMinutes = 0
        const updates = []

        console.log(`[Batch] Start processing. Requests:`, requests)
        console.log(`[Batch] Found ${jornadas.length} eligible jornadas for user ${user.id}`)

        // 2. Iterate through requests and allocate (FIFO)
        for (const [type, minutesRequested] of Object.entries(requests)) {
            let remainingToBank = parseInt(minutesRequested)
            console.log(`[Batch] Processing Request type: ${type}, Amount: ${remainingToBank}`)

            if (remainingToBank <= 0) continue

            for (const jornada of jornadas) {
                if (remainingToBank <= 0) break

                // Get available minutes for this type in this jornada
                const breakdown = jornada.horas_extra_hhmm?.breakdown ||
                    jornada.horas_extra_hhmm?.flatBreakdown ||
                    jornada.horas_extra_hhmm?.breakdown_legacy || {}

                // console.log(`[Batch] Jornada ${jornada.date} breakdown:`, JSON.stringify(breakdown))

                let availableTotal = 0
                if (breakdown.overtime && breakdown.overtime[type]) availableTotal = breakdown.overtime[type]
                else if (breakdown.surcharges && breakdown.surcharges[type]) availableTotal = breakdown.surcharges[type]
                else if (breakdown[type]) availableTotal = breakdown[type]

                // console.log(`[Batch] Jornada ${jornada.date} has available ${type}: ${availableTotal}`)

                if (!availableTotal || availableTotal <= 0) continue

                // Check how much is already banked for this specific type
                const currentDesglose = jornada.desglose_compensacion || {}
                const alreadyBanked = currentDesglose[type] || 0

                const availableForBanking = availableTotal - alreadyBanked

                if (availableForBanking <= 0) continue

                // Deduct
                const take = Math.min(remainingToBank, availableForBanking)

                // Update Local & Track
                currentDesglose[type] = alreadyBanked + take

                // Track total added to pool across all types
                totalProcessedMinutes += take

                // Calculate new total banked for this jornada
                const newTotalBanked = Object.values(currentDesglose).reduce((a, b) => a + b, 0)

                // Update Jornada
                // Crucial: Updating 'desglose_compensacion' triggers the DB function 'sync_resumen_horas'
                // which automatically decreases the 'Available' balance in 'resumen_horas_extra'.
                jornada.desglose_compensacion = currentDesglose

                updates.push({
                    id: jornada.id,
                    desglose_compensacion: currentDesglose,
                    horas_para_bolsa_minutos: newTotalBanked,
                    estado_compensacion: 'APROBADO'
                })

                remainingToBank -= take
            }
        }

        if (totalProcessedMinutes > 0) {
            // 3. Update Jornadas (Batch)
            // Deduplicate logic: utilize the latest state of each jornada from `jornadas` array or `updates` list.
            const uniqueUpdates = {}
            updates.forEach(u => {
                uniqueUpdates[u.id] = u // Last write wins, which has accumulated changes
            })

            console.log(`Updating ${Object.keys(uniqueUpdates).length} jornadas with total ${totalProcessedMinutes} minutes banked.`)

            for (const update of Object.values(uniqueUpdates)) {
                const { error: updateError } = await supabaseAdmin
                    .from("jornadas")
                    .update({
                        desglose_compensacion: update.desglose_compensacion,
                        horas_para_bolsa_minutos: update.horas_para_bolsa_minutos,
                        estado_compensacion: update.estado_compensacion
                    })
                    .eq("id", update.id)

                if (updateError) {
                    console.error(`Error updating jornada ${update.id}:`, updateError)
                    throw new Error(`Error updating jornada: ${updateError.message}`)
                }
            }

            // 4. Update User Balance (Immediate)
            const currentBalance = user.bolsa_horas_minutos || 0
            const newBalance = currentBalance + totalProcessedMinutes

            const { error: userUpdateError } = await supabaseAdmin
                .from("usuarios")
                .update({ bolsa_horas_minutos: newBalance })
                .eq("id", user.id)

            if (userUpdateError) {
                console.error("Error updating user balance:", userUpdateError)
                // Continue? Critical error.
            }

            // 5. Create History Record
            const { error: historyError } = await supabaseAdmin
                .from("historial_bolsa")
                .insert({
                    usuario_id: user.id,
                    tipo_movimiento: 'ACUMULACION',
                    minutos: totalProcessedMinutes,
                    saldo_resultante: newBalance,
                    observacion: 'Acumulación automática desde historial',
                    realizado_por: user.id
                })

            if (historyError) console.error("History logging error", historyError)
        }

        return NextResponse.json({
            message: "Solicitud procesada y aprobada correctamente",
            accumulated: totalProcessedMinutes
        })

    } catch (error) {
        console.error("Error batch banking:", error)
        return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
    }
}
