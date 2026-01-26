
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export async function GET(request) {
    const { searchParams } = new URL(request.url)
    const periodo_inicio = searchParams.get("inicio")
    const periodo_fin = searchParams.get("fin")

    if (!periodo_inicio || !periodo_fin) {
        return NextResponse.json({ message: "Fechas requeridas" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
        .from("aprobaciones_periodo")
        .select("*")
        .eq("periodo_inicio", periodo_inicio)
        .eq("periodo_fin", periodo_fin)

    if (error) return NextResponse.json({ message: error.message }, { status: 500 })

    return NextResponse.json(data)
}

export async function POST(request) {
    try {
        const body = await request.json()
        const { empleado_id, jefe_id, periodo_inicio, periodo_fin, firma_snapshot } = body

        // Upsert approval
        // Check if exists first to avoid dupes or usage Upsert on unique constraint if I had one (I didn't add unique constraint in SQL script but logic should handle)

        // Better: Delete existing for this period/employee then insert, or just insert if not exists.
        // Let's usage upsert based on ID if we had it, but here we define uniqueness by (employee, period).

        // Let's delete previous approval for this period to be safe (re-approval)
        await supabaseAdmin
            .from("aprobaciones_periodo")
            .delete()
            .eq("empleado_id", empleado_id)
            .eq("periodo_inicio", periodo_inicio)
            .eq("periodo_fin", periodo_fin)

        const { data, error } = await supabaseAdmin
            .from("aprobaciones_periodo")
            .insert({
                empleado_id,
                jefe_id,
                periodo_inicio,
                periodo_fin,
                firma_snapshot,
                estado: 'APROBADO'
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json(data)
    } catch (error) {
        console.error("Error saving approval:", error)
        return NextResponse.json({ message: "Error al guardar aprobación" }, { status: 500 })
    }
}
