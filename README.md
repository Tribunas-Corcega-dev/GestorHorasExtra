# Gestor de Horas Extra - Tribunas Córcega

Sistema integral para la gestión de jornadas laborales, horas extra y nómina, diseñado para optimizar el flujo de aprobación y reporte entre empleados, coordinadores y la gerencia.

## 🚀 Tecnologías Principales

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Lenguaje**: JavaScript (ES6+)
- **Base de Datos**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Autenticación**: JWT + Supabase Auth (Custom Implementation)
- **UI/UX**: 
  - [Tailwind CSS v4](https://tailwindcss.com/)
  - [Shadcn UI](https://ui.shadcn.com/) (Radix Primitives)
  - [Lucide React](https://lucide.dev/) (Iconografía)
- **Manejo de Fechas**: `dayjs` (anteriormente `date-fns` en migración)
- **Validación**: `zod` + `react-hook-form`

## 👥 Gestión de Roles y Permisos

El sistema implementa un control de acceso basado en roles (`RBAC`) definido en `lib/permissions.js`.

| Rol | Descripción | Permisos Clave |
| :--- | :--- | :--- |
| **ADMINISTRADOR** | Superusuario del sistema | Acceso total a configuraciones y base de datos. |
| **GERENCIA** | Alta dirección | Visualización global, reportes financieros. |
| **TALENTO_HUMANO** | Gestión de personal | ABM de empleados, aprobación final de horas, reportes de nómina. |
| **JEFE** | Supervisores de área | Aprobación de horas de su equipo, visualización de reportes de área. |
| **COORDINADOR** | Líderes operativos | Gestión diaria de jornadas, validación inicial de horas extra. |
| **OPERARIO** | Empleados base | Registro de entrada/salida, visualización de historial propio. |

## 🛠️ Scripts de Mantenimiento

El proyecto incluye herramientas de administración en la carpeta `scripts/` para tareas de base de datos y depuración:

- `force_populate_resumen.js`: Recalcula y llena la tabla `resumen_horas_extra` con los acumulados históricos. Útil tras correcciones manuales en jornadas.
- `check_schema.js`: Verifica la integridad del esquema de la base de datos.
- `debug_data.js`: Script para inspeccionar el estado actual de los datos sin acceder a la DB directamente.
- `create_automatic_balance_trigger.sql`: Define los triggers de PostgreSQL para actualizaciones automáticas.

## 📂 Estructura del Proyecto

GestorHorasExtra/
├── app/                        # Next.js App Router
│   ├── ajustes/                # Configuración de usuario (Firma digital, etc.)
│   ├── apelaciones/            # Gestión de reclamos y correcciones de horas
│   ├── api/                    # API Routes (Backend logic)
│   │   ├── aprobaciones/       # Endpoints de firma digital
│   │   ├── cierre/             # Lógica de cierre de quincena
│   │   ├── jornadas/           # CRUD de jornadas laborales
│   │   └── reportes/           # Generación de datos para dashboards
│   ├── dashboard/              # Vistas protegidas por rol
│   │   ├── jefe/               # Panel de Aprobación (Gerencia/Jefes)
│   │   ├── talento-humano/     # Panel de RRHH
│   │   ├── coordinador/        # Panel de Coordinación
│   │   └── operario/           # Vista de empleado
│   ├── empleados/              # Gestión de usuarios (CRUD)
│   ├── horas-extra/            # Flujo de registro y visualización de horas
│   └── login/                  # Autenticación
├── components/                 # Componentes React
│   ├── ui/                     # Primitivas Shadcn UI (Button, Card, Dialog...)
│   ├── Layout.js               # Layout principal con navegación lateral
│   ├── ScheduleSelector.jsx    # Componente complejo de selección de horas
│   └── SignatureCanvas.jsx     # Pad de firma digital
├── context/                    # React Context (AuthContext)
├── hooks/                      # Custom Hooks (useAuth)
├── lib/                        # Lógica de negocio y utilidades
│   ├── calculations.js         # MOTOR DE CÁLCULO (Horas extra, recargos, festivos)
│   ├── permissions.js          # Definiciones de roles y acceso (RBAC)
│   └── supabaseClient.js       # Cliente DB
├── scripts/                    # Herramientas de administración (Node.js)
└── public/                     # Assets estáticos (Logos, iconos)

## ⚙️ Instalación y Configuración

1. **Clonar repositorio**
   ```bash
   git clone https://github.com/Tribunas-Corcega-dev/GestorHorasExtra.git
   cd GestorHorasExtra
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Variables de Entorno**
   Crear archivo `.env` en la raíz:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
   JWT_SECRET=tu-secreto-seguro
   ```

4. **Ejecutar en desarrollo**
   ```bash
   npm run dev
   ```

## 📝 Notas de Desarrollo

- **Manejo de Horarios**: El sistema calcula automáticamente recargos nocturnos, dominicales y festivos basándose en la legislación laboral vigente configurada en los utilitarios de fecha.
- **Seguridad**: Todas las rutas de API y Páginas están protegidas mediante `middleware` y verificaciones de sesión en servidor (`VerifyToken`).