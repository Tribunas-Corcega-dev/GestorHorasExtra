import { NextResponse } from 'next/server'
import * as jwt from 'jose'
import { JWT_SECRET } from '@/lib/env'

export async function middleware(request) {
  const token = request.cookies.get('auth_token')?.value
  const { pathname } = request.nextUrl
  
  // Rutas públicas que no requieren auth
  const isPublicRoute = pathname.startsWith('/login') || pathname.startsWith('/_next') || pathname.startsWith('/api/auth') || pathname.startsWith('/assets') || pathname === '/favicon.ico'

  if (isPublicRoute) {
    if (token && pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Verificar token para rutas privadas
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET)
    const { payload } = await jwt.jwtVerify(token, secret)
    const rol = payload.rol
    const userId = payload.id?.toString()
    
    // REGLA 1: Ajustes
    // Permitir acceso a TALENTO_HUMANO, ASISTENTE_GERENCIA, JEFE, COORDINADOR. Operarios no.
    if (pathname.startsWith('/ajustes')) {
        const canAccessAjustes = ["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "JEFE", "COORDINADOR"].includes(rol)
        if (!canAccessAjustes) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }
    }
    
    // REGLA 2: Empleados y Horas Extra
    if (pathname.startsWith('/empleados') || pathname.startsWith('/horas-extra')) {
        const isManagementRole = ["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "JEFE", "COORDINADOR"].includes(rol)
        
        if (!isManagementRole) {
            // Lógica para OPERARIO u otros roles no gestores:
            // Solo pueden ver su propia información si la ruta incluye su ID.
            // Ejemplo pathname: /horas-extra/123/historial -> segments: ['horas-extra', '123', 'historial']
            const segments = pathname.split('/').filter(Boolean)
            const targetId = segments[1] // El ID debe estar en la posición 1
            
            // Bloquear si intentan acceder a la lista general (/horas-extra o /empleados)
            // o si el ID en la URL no coincide con su propio ID
            if (!targetId || targetId !== userId) {
                return NextResponse.redirect(new URL('/dashboard', request.url))
            }
        }
    }

    return NextResponse.next()
  } catch (error) {
    console.error("Token verification failed in middleware", error)
    // Token is invalid/expired
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth_token')
    return response
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
