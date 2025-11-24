# Gestor de Horas Extra

Aplicación web para la gestión, registro y aprobación de horas extra de empleados, diseñada para optimizar el flujo de trabajo entre coordinadores, talento humano y gerencia.

## Características Principales

- **Gestión de Roles**: Paneles específicos para Coordinadores, Talento Humano, Jefes y Gerencia.
- **Registro de Jornadas**: Interfaz intuitiva para registrar horas de entrada y salida, incluyendo cálculo automático de días de la semana.
- **Historial**: Visualización detallada del historial de horas extra por empleado.
- **Seguridad**: Autenticación y rutas protegidas basadas en roles.

## Guía de Instalación

Sigue estos pasos para configurar el proyecto en tu entorno local:

### 1. Clonar el Repositorio

```bash
git clone https://github.com/Tribunas-Corcega-dev/GestorHorasExtra.git
cd GestorHorasExtra
```

### 2. Instalar Dependencias

Este proyecto utiliza `npm` como gestor de paquetes.

```bash
npm install
```

### 3. Configuración de Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto y configura las siguientes variables (necesitarás credenciales de Supabase):

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
JWT_SECRET=tu_secreto_jwt
```

### 4. Ejecutar el Servidor de Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

## Estructura del Código

El proyecto sigue la arquitectura de **Next.js App Router**.

```
GestorHorasExtra/
├── app/                    # Rutas y páginas de la aplicación (App Router)
│   ├── api/                # Endpoints de la API (Backend)
│   ├── dashboard/          # Paneles principales por rol
│   ├── empleados/          # Gestión de empleados
│   ├── horas-extra/        # Módulo de registro e historial de horas
│   ├── login/              # Página de inicio de sesión
│   └── layout.jsx          # Layout principal
├── components/             # Componentes reutilizables (UI, Layouts, Selectors)
├── hooks/                  # Custom Hooks (useAuth, etc.)
├── lib/                    # Utilidades y configuración (Supabase, Permisos)
├── public/                 # Archivos estáticos
└── styles/                 # Estilos globales
```

## Tecnologías Utilizadas

- **Framework**: Next.js 14
- **Lenguaje**: JavaScript / React
- **Estilos**: Tailwind CSS
- **Base de Datos / Auth**: Supabase