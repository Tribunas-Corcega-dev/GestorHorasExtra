"use client"

import { useRef, useState, useEffect } from "react"

export function SignatureCanvas({ onEnd, width = 500, height = 200 }) {
    const canvasRef = useRef(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [isEmpty, setIsEmpty] = useState(true)

    useEffect(() => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.lineWidth = 2
        ctx.strokeStyle = "black"
    }, [])

    const startDrawing = (e) => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        const rect = canvas.getBoundingClientRect()
        const x = (e.clientX || e.touches[0].clientX) - rect.left
        const y = (e.clientY || e.touches[0].clientY) - rect.top

        ctx.beginPath()
        ctx.moveTo(x, y)
        setIsDrawing(true)
        setIsEmpty(false)
    }

    const draw = (e) => {
        if (!isDrawing) return
        e.preventDefault() // Internal scrolling prevention on touch

        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        const rect = canvas.getBoundingClientRect()
        const x = (e.clientX || e.touches[0].clientX) - rect.left
        const y = (e.clientY || e.touches[0].clientY) - rect.top

        ctx.lineTo(x, y)
        ctx.stroke()
    }

    const endDrawing = () => {
        if (!isDrawing) return
        setIsDrawing(false)
        if (onEnd) {
            onEnd(canvasRef.current.toDataURL("image/png"))
        }
    }

    const clear = () => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext("2d")
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        setIsEmpty(true)
        if (onEnd) onEnd(null)
    }

    return (
        <div className="space-y-2">
            <div className="border-2 border-dashed border-gray-300 rounded-lg touch-none inline-block bg-white">
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={endDrawing}
                    onMouseLeave={endDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={endDrawing}
                    className="cursor-crosshair block"
                />
            </div>
            <div>
                <button
                    type="button"
                    onClick={clear}
                    className="text-xs text-red-500 hover:text-red-700 font-medium underline"
                >
                    Borrar Firma
                </button>
            </div>
        </div>
    )
}
