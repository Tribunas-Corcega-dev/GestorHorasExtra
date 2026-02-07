"use client"

import { createContext, useContext, useState } from "react"

const SidebarContext = createContext()

export function SidebarProvider({ children }) {
    // Store the indicator style here so it persists across page navigations
    const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, opacity: 0 })

    return (
        <SidebarContext.Provider value={{ indicatorStyle, setIndicatorStyle }}>
            {children}
        </SidebarContext.Provider>
    )
}

export function useSidebar() {
    const context = useContext(SidebarContext)
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider")
    }
    return context
}
