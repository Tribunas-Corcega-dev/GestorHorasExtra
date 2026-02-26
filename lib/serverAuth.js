import { cookies } from "next/headers"
import * as jwt from "jose"
import { JWT_SECRET } from "@/lib/env"

export async function getServerUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth_token")?.value

  if (!token) {
    return null
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwt.jwtVerify(token, secret)
    return payload
  } catch (error) {
    return null
  }
}
