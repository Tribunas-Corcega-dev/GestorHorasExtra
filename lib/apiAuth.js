import * as jwt from "jose"
import { JWT_SECRET } from "@/lib/env"
import { prisma } from "@/lib/prisma"

const secret = new TextEncoder().encode(JWT_SECRET)

export async function getAuthPayloadFromRequest(request) {
  const token = request.cookies.get("auth_token")?.value
  if (!token) {
    return null
  }

  try {
    const { payload } = await jwt.jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}

export async function getUserFromRequest(request, options = {}) {
  void options
  const payload = await getAuthPayloadFromRequest(request)
  if (!payload?.id) {
    return null
  }

  const user = await prisma.usuarios.findUnique({ where: { id: payload.id } })
  return user || null
}
