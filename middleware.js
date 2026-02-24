import { NextResponse } from 'next/server'
import * as jwt from 'jose'

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

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
    
    // Authorization / Role-based routing
    // Proteger /ajustes para todos excepto TALENTO_HUMANO y ASISTENTE_GERENCIA
    if (pathname.startsWith('/ajustes') && !['TALENTO_HUMANO', 'ASISTENTE_GERENCIA'].includes(payload.rol)) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    
    // Proteger las páginas de empleados / horas extra
    const canManageEmps = ["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "JEFE", "COORDINADOR"].includes(payload.rol)
    if ((pathname.startsWith('/empleados') || pathname.startsWith('/horas-extra')) && !canManageEmps) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
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
