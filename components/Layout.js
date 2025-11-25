"use client"

import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { isWorker, canManageOvertime } from "@/lib/permissions"
import { useState } from "react"

export function Layout({ children }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  if (!user) return children

  const showEmployeesLink = !isWorker(user.rol)
  const showOvertimeLink = canManageOvertime(user.rol)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/logo.png" alt="TribunasClock Logo" className="h-8 w-8" />
            <h1 className="text-xl font-bold">TribunasClock</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* User Info */}
            <div className="hidden md:flex flex-col items-end text-sm">
              <span className="font-semibold">{user.username}</span>
              <span className="text-xs opacity-90">{user.rol}</span>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="bg-primary-foreground text-primary px-4 py-2 rounded-md hover:opacity-90 transition-opacity text-sm font-medium"
            >
              Cerrar sesión
            </button>

            {/* Mobile Menu Toggle */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2" aria-label="Toggle menu">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:block w-64 bg-card border-r border-border min-h-[calc(100vh-73px)]">
          <nav className="p-4 space-y-2">
            <Link
              href="/dashboard"
              className="block px-4 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Dashboard
            </Link>
            {showEmployeesLink && (
              <Link
                href="/empleados"
                className="block px-4 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Empleados
              </Link>
            )}
            {showOvertimeLink && (
              <>
                <Link
                  href="/horas-extra"
                  className="block px-4 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Horas Extra
                </Link>
                <Link
                  href="/ajustes"
                  className="block px-4 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Ajustes
                </Link>
              </>
            )}
          </nav>
        </aside>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setMenuOpen(false)}>
            <div className="bg-card w-64 h-full p-4 space-y-2" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 pb-4 border-b border-border">
                <p className="font-semibold">{user.username}</p>
                <p className="text-sm text-muted-foreground">{user.rol}</p>
              </div>
              <Link
                href="/dashboard"
                className="block px-4 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Dashboard
              </Link>
              {showEmployeesLink && (
                <Link
                  href="/empleados"
                  className="block px-4 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  Empleados
                </Link>
              )}
              {showOvertimeLink && (
                <>
                  <Link
                    href="/horas-extra"
                    className="block px-4 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Horas Extra
                  </Link>
                  <Link
                    href="/ajustes"
                    className="block px-4 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Ajustes
                  </Link>
                </>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
