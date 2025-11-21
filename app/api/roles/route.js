import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export async function GET() {
  try {
    const { data: roles, error } = await supabase.from("roles").select("nombre").order("nombre")

    if (error) {
      console.error("[v0] Error fetching roles:", error)
      return NextResponse.json({ message: "Error al obtener roles" }, { status: 500 })
    }

    return NextResponse.json(roles.map((r) => r.nombre))
  } catch (error) {
    console.error("[v0] Error in GET roles:", error)
    return NextResponse.json({ message: "Error interno del servidor" }, { status: 500 })
  }
}
