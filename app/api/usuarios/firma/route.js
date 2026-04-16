import { NextResponse } from "next/server"

const disabledPayload = {
    message: "La firma digital fue deshabilitada. Use firma fisica en formato impreso.",
}

export async function GET() {
    return NextResponse.json(disabledPayload, { status: 410 })
}

export async function POST() {
    return NextResponse.json(disabledPayload, { status: 410 })
}
