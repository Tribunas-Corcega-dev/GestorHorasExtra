"use client"

import Link from "next/link"
import { useAuth } from "@/hooks/useAuth"
import { isWorker, canManageOvertime } from "@/lib/permissions"
import { useState } from "react"

export function Layout({ children }) {
  const { user, logout } = useAuth()

  if (!user) return children

  const showEmployeesLink = !isWorker(user.rol)
  const showOvertimeLink = canManageOvertime(user.rol) || isWorker(user.rol)

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-md z-10">
        <div className="container mx-auto px-2 md:px-4 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <img src="/assets/logo.png" alt="TribunasClock Logo" className="h-6 w-6 md:h-8 md:w-8" />
            <h1 className="text-base md:text-xl font-bold">TribunasClock</h1>
          </div>

          <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
            {/* User Info */}
            <div className="flex flex-col items-end text-xs md:text-sm min-w-0">
              <span className="font-semibold truncate max-w-[120px] md:max-w-none">{user.username}</span>
              <span className="text-[10px] md:text-xs opacity-90 truncate max-w-[120px] md:max-w-none">{user.rol}</span>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="bg-primary-foreground text-primary px-4 py-2 rounded-md hover:opacity-90 transition-opacity text-sm font-medium hidden md:block flex-shrink-0"
            >
              Cerrar sesión
            </button>
            <button
              onClick={logout}
              className="md:hidden p-1.5 flex-shrink-0"
              aria-label="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pb-16 md:pb-0">
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
            {/* Worker Specific Link */}
            {isWorker(user.rol) && (
              <Link
                href={`/horas-extra/${user.id}/historial`}
                className="block px-4 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                Mis Horas Extra
              </Link>
            )}

            {/* Manager specific links previously grouped under showOvertimeLink */}
            {canManageOvertime(user.rol) && (
              <>
                {/* Managers use Empleados for Overtime now, so no separate link needed */}
                <Link
                  href="/apelaciones"
                  className="block px-4 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Apelaciones
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

        {/* Mobile Tab Navigator */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 flex justify-around items-center h-16 px-2">
          <Link href="/dashboard" className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-primary">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="text-[10px]">Dashboard</span>
          </Link>

          {showEmployeesLink && (
            <Link href="/empleados" className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-primary">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="text-[10px]">Empleados</span>
            </Link>
          )}

          {isWorker(user.rol) && (
            <Link href={`/horas-extra/${user.id}/historial`} className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-primary">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[10px]">Mis Horas</span>
            </Link>
          )}

          {canManageOvertime(user.rol) && (
            <>
              <Link href="/apelaciones" className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-primary">
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-[10px]">Apelaciones</span>
              </Link>
              <Link href="/ajustes" className="flex flex-col items-center justify-center w-full h-full text-muted-foreground hover:text-primary">
                <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[10px]">Ajustes</span>
              </Link>
            </>
          )}
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 min-w-0">{children}</main>
      </div>
    </div>
  )
}
