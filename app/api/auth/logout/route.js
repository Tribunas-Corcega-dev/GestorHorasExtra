import { NextResponse } from "next/server"

export async function POST() {
  const response = NextResponse.json({ message: "Sesión cerrada" })

  response.cookies.set("auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  })

  return response
}
