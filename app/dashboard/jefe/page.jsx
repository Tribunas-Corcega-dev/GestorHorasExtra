import { Layout } from "@/components/Layout"
import { JefeContentClient } from "./JefeContentClient"

export default function JefeDashboard() {
    // rerender-lazy-state-init / move to server: Compute initial period on the server once
    const now = new Date()
    const isFirstQ = now.getDate() <= 15
    const y = now.getFullYear()
    const m = now.getMonth()
    
    let initialPeriod
    if (isFirstQ) {
        initialPeriod = {
            start: `${y}-${String(m + 1).padStart(2, '0')}-01`,
            end: `${y}-${String(m + 1).padStart(2, '0')}-15`
        }
    } else {
        const lastDay = new Date(y, m + 1, 0).getDate()
        initialPeriod = {
            start: `${y}-${String(m + 1).padStart(2, '0')}-16`,
            end: `${y}-${String(m + 1).padStart(2, '0')}-${lastDay}`
        }
    }

    return (
        <Layout>
            <JefeContentClient initialPeriod={initialPeriod} />
        </Layout>
    )
}
