import { redirect } from "next/navigation"
import { getServerUser } from "@/lib/serverAuth"

export default async function DashboardPage() {
  const user = await getServerUser()
  
  if (!user) {
    redirect("/login")
  }

  const roleRoutes = {
    JEFE: "/dashboard/jefe",
    TALENTO_HUMANO: "/dashboard/talento-humano",
    ASISTENTE_GERENCIA: "/dashboard/talento-humano",
    COORDINADOR: "/dashboard/coordinador",
    OPERARIO: "/dashboard/operario",
  }

  const targetRoute = roleRoutes[user.rol]

  if (targetRoute) {
    redirect(targetRoute)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center text-red-500">
        <p>Rol no reconocido o acceso denegado.</p>
      </div>
    </div>
  )
}
