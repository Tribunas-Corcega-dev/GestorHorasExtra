import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/context/AuthContext"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata = {
  title: "TribunasClock",
  icons: {
    icon: "/assets/logo.png",
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
