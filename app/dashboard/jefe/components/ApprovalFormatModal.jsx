"use client"

import { useState, useEffect, useRef } from "react"
import { LABELS } from "@/lib/utils"

export function ApprovalFormatModal({ isOpen, onClose, employee, period, jefe, existingApproval }) {
    const [jornadas, setJornadas] = useState([])
    const [loading, setLoading] = useState(true)
    const [signing, setSigning] = useState(false)
    const [jefeSignature, setJefeSignature] = useState(null) // From DB profile

    if (!isOpen) return null

    // Handle ESC key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") onClose()
        }
        window.addEventListener("keydown", handleEsc)
        return () => window.removeEventListener("keydown", handleEsc)
    }, [onClose])

    // Fetch hours for the period
    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                // Fetch Jornadas
                const res = await fetch(`/api/jornadas?empleado_id=${employee.id}&inicio=${period.start}&fin=${period.end}`)
                const data = await res.json()
                // Filter only those with overtime
                const relevant = data.filter(j => {
                    const h = j.horas_extra_hhmm || {}
                    // Check if has any value > 0 in breakdown
                    const hasHours = Object.values(h.breakdown || {}).some(v => v > 0) ||
                        Object.values(h.breakdown?.overtime || {}).some(v => v > 0) ||
                        Object.values(h.breakdown?.surcharges || {}).some(v => v > 0)
                    return hasHours
                })
                setJornadas(relevant)

                // Fetch Jefe Signature
                const resSig = await fetch("/api/usuarios/firma") // My signature
                if (resSig.ok) {
                    const d = await resSig.json()
                    setJefeSignature(d.firma)
                }

            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [employee, period])

    const handleApprove = async (withSignature) => {
        if (withSignature && !jefeSignature) {
            alert("No tienes una firma configurada. Ve a Ajustes > Firma Digital.")
            return
        }

        setSigning(true)
        try {
            const res = await fetch("/api/aprobaciones/firma", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    empleado_id: employee.id,
                    jefe_id: jefe.id,
                    periodo_inicio: period.start,
                    periodo_fin: period.end,
                    firma_snapshot: withSignature ? jefeSignature : null
                })
            })
            if (res.ok) {
                alert("Documento aprobado correctamente.")
                onClose()
            } else {
                alert("Error al aprobar.")
            }
        } catch (e) {
            console.error(e)
            alert("Error de conexión.")
        } finally {
            setSigning(false)
        }
    }

    const handlePrint = () => {
        window.print()
    }

    // Helper to extract nice hours
    const getHours = (j) => {
        // Flatten logic
        const h = j.horas_extra_hhmm || {}
        let flat = { ...h.breakdown }
        if (h.breakdown?.overtime) Object.assign(flat, h.breakdown.overtime)
        if (h.breakdown?.surcharges) Object.assign(flat, h.breakdown.surcharges)

        // Filter keys
        const parts = []
        Object.entries(flat).forEach(([k, v]) => {
            if (v > 0 && LABELS[k]) {
                const hours = Math.floor(v / 60)
                const mins = v % 60
                parts.push(`${LABELS[k]}: ${hours}h ${mins}m`)
            }
        })
        return parts.join(", ")
    }

    // Calculate total hours sum for footer
    const totalMinutes = jornadas.reduce((acc, j) => {
        const h = j.horas_extra_hhmm || {}
        // Rough sum of all relevant fields
        let sum = 0;
        const flat = { ...h.breakdown, ...(h.breakdown?.overtime || {}), ...(h.breakdown?.surcharges || {}) }
        Object.values(flat).forEach(v => { if (typeof v === 'number') sum += v })
        return acc + sum
    }, 0)
    const totalH = Math.floor(totalMinutes / 60)
    const totalM = totalMinutes % 60


    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm p-4 flex justify-center items-start print:p-0 print:bg-white print:block">
            <div className="bg-white text-black w-full max-w-5xl shadow-2xl rounded-sm p-4 my-8 relative print:shadow-none print:w-full print:max-w-none print:my-0 print:p-0">

                {/* Close Button (Hide on Print) */}
                <div className="flex justify-between mb-4 print:hidden">
                    <h2 className="text-xl font-bold">Vista Preliminar de Aprobación</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors" title="Cerrar (Esc)">
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* THE FORMAT (A4-ish) */}
                <div className="border border-black p-1 w-full max-w-[210mm] mx-auto bg-white print:border-0 overflow-x-auto">

                    {/* Header */}
                    <div className="border border-black flex">
                        <div className="w-32 border-r border-black p-2 flex items-center justify-center">
                            {/* Logo */}
                            <img
                                src="/assets/logo.png"
                                alt="Logo Tribunas"
                                className="w-full h-auto object-contain max-h-24"
                            />
                        </div>
                        <div className="flex-1 text-center p-2 flex flex-col justify-center">
                            <h1 className="font-bold text-lg leading-tight">LA ASOCIACIÓN DE SUSCRIPTORES DE LA EMPRESA DE SERVICIOS TRIBUNAS CÓRCEGA E.S.P. <br /> NIT. 816.003.198-3</h1>
                            <p className="text-xs mt-1">VIGILADA POR LA SUPERINTENDENCIA DE SERVICIOS PÚBLICOS - SSP ID. 3013</p>
                            <h2 className="font-bold text-md mt-2 border-t border-black pt-1 block w-full">REGISTRO DE HORA EXTRA</h2>
                        </div>
                        <div className="w-48 border-l border-black text-[10px]">
                            <div className="border-b border-black p-1">Código: GA - AP - R - RHE - 01</div>
                            <div className="border-b border-black p-1">Fecha creación: 30 abril 2014</div>
                            <div className="p-1">Fecha actualización: 1 julio 2017</div>
                        </div>
                    </div>

                    {/* Employee Info */}
                    <div className="border border-t-0 border-black text-sm">
                        <div className="flex border-b border-black">
                            <div className="w-48 font-bold p-1 border-r border-black bg-gray-100">NOMBRE DEL EMPLEADO</div>
                            <div className="p-1 px-2 flex-1 uppercase">{employee.nombre}</div>
                        </div>
                        <div className="flex">
                            <div className="w-48 font-bold p-1 border-r border-black bg-gray-100">FECHA DE AUTORIZACIÓN</div>
                            <div className="p-1 px-2 flex-1">{new Date().toLocaleDateString()}</div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="mt-4 min-h-[400px]">
                        <table className="w-full border-collapse border border-black text-[10px] md:text-xs">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-black p-1 w-24">FECHA</th>
                                    <th className="border border-black p-1 w-24">DESDE LAS</th>
                                    <th className="border border-black p-1 w-24">HASTA LAS</th>
                                    <th className="border border-black p-1">HORAS EXTRA / RECARGOS</th>
                                    <th className="border border-black p-1 w-1/3">JUSTIFICACION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && <tr><td colSpan="5" className="p-4 text-center">Cargando datos...</td></tr>}
                                {!loading && jornadas.length === 0 && <tr><td colSpan="5" className="p-8 text-center italic">No se registraron horas extra en este período.</td></tr>}
                                {jornadas.map(j => {
                                    // Calculate time range (assuming single chunk or summary)
                                    const entry = j.hora_entrada_turno ? j.hora_entrada_turno.slice(0, 5) : ""
                                    const exit = j.hora_salida_turno ? j.hora_salida_turno.slice(0, 5) : ""
                                    return (
                                        <tr key={j.id}>
                                            <td className="border border-black p-1 text-center">{new Date(j.fecha).toLocaleDateString()}</td>
                                            <td className="border border-black p-1 text-center">{entry}</td>
                                            <td className="border border-black p-1 text-center">{exit}</td>
                                            <td className="border border-black p-1 text-xs">{getHours(j)}</td>
                                            <td className="border border-black p-1 text-xs">{j.observaciones || ""}</td>
                                        </tr>
                                    )
                                })}
                                {/* Fill empty rows to look like the format */}
                                {Array.from({ length: Math.max(0, 10 - jornadas.length) }).map((_, i) => (
                                    <tr key={`empty-${i}`}>
                                        <td className="border border-black p-4">&nbsp;</td>
                                        <td className="border border-black p-4">&nbsp;</td>
                                        <td className="border border-black p-4">&nbsp;</td>
                                        <td className="border border-black p-4">&nbsp;</td>
                                        <td className="border border-black p-4">&nbsp;</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    <div className="border border-black border-t-0 p-1 flex font-bold text-sm">
                        <div className="w-[60%]">TOTAL HORAS PERIODO</div>
                        <div className="flex-1 text-right px-4">{totalH} Horas {totalM} Minutos</div>
                    </div>

                    {/* Signatures */}
                    <div className="mt-16 mb-8 flex justify-between px-10">
                        {/* Gerente Signature (Dynamic) */}
                        <div className="text-center w-64">
                            <div className="border-b border-black mb-2 h-16 flex items-end justify-center relative">
                                {(existingApproval?.firma_snapshot || (existingApproval && jefeSignature) || null) ? (
                                    <img
                                        src={existingApproval?.firma_snapshot || jefeSignature}
                                        alt="Firma"
                                        className="h-20 absolute bottom-0 object-contain" // Floating on line
                                    />
                                ) : null}
                            </div>
                            <div className="font-bold text-sm">GERENTE</div>
                        </div>

                        {/* Coordinator Signature (Static/Empty for now as per image) */}
                        <div className="text-center w-64">
                            <div className="border-b border-black mb-2 h-16"></div>
                            <div className="font-bold text-sm">COORDINADOR RESPONSABLE</div>
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="text-center text-[10px] mt-8 mb-4">
                        Kilómetro 5 vía Armenia Vereda Huertas, Teléfonos: 3119762 - 3119733<br />
                        E-mail: esptricorc@yahoo.es
                    </div>

                </div>

                {/* Actions (Hide on Print) */}
                <div className="mt-6 flex justify-end gap-3 print:hidden bg-gray-50 p-4 rounded border-t border-gray-200">
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 border border-blue-300 text-blue-700 rounded hover:bg-blue-50 font-medium flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Imprimir / Guardar PDF
                    </button>
                    {!existingApproval && (
                        <>
                            <button
                                onClick={() => handleApprove(false)}
                                disabled={signing}
                                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 font-medium"
                            >
                                Aprobar SIN Firma
                            </button>
                            <button
                                onClick={() => handleApprove(true)}
                                disabled={signing}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium shadow-md flex items-center gap-2"
                            >
                                {signing ? "Procesando..." : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Aprobar y Firmar Digitalmente
                                    </>
                                )}
                            </button>
                        </>
                    )}
                    {existingApproval && (
                        <div className="px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded font-bold flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            APROBADO
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
