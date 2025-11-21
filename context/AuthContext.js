"use client"

import { createContext, useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    refreshUser()
  }, [])

  async function refreshUser() {
    try {
      const res = await fetch("/api/auth/me")
      if (res.ok) {
        const userData = await res.json()
        setUser(userData)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error("[v0] Error refreshing user:", error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function login(username, password) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.message || "Error al iniciar sesión")
    }

    const userData = await res.json()
    setUser(userData)
    return userData
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
    router.push("/login")
  }

  async function register(data) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.message || "Error al registrar usuario")
    }

    return await res.json()
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
