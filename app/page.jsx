import { redirect } from "next/navigation"
import { getServerUser } from "@/lib/serverAuth"

export default async function HomePage() {
  const user = await getServerUser()
  
  if (user) {
    redirect("/dashboard")
  } else {
    redirect("/login")
  }
}
