import { NextResponse } from "next/server"

const disabledPayload = {
    message: "La aprobacion digital fue deshabilitada. Use impresion para firma fisica.",
}

export async function GET() {
    return NextResponse.json(disabledPayload, { status: 410 })
}

export async function POST() {
    return NextResponse.json(disabledPayload, { status: 410 })
}
