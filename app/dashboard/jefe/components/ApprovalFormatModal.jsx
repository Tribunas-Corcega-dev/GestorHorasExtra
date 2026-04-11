"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { LABELS } from "@/lib/utils"

export function ApprovalFormatModal({ isOpen, onClose, employee, period }) {
    const [jornadas, setJornadas] = useState([])
    const [loading, setLoading] = useState(true)
    const dataCacheRef = useRef(new Map())

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") onClose()
        }
        window.addEventListener("keydown", handleEsc)
        return () => window.removeEventListener("keydown", handleEsc)
    }, [onClose])

    useEffect(() => {
        if (!isOpen || !employee?.id || !period?.start || !period?.end) return

        const cacheKey = `${employee.id}|${period.start}|${period.end}`
        const cached = dataCacheRef.current.get(cacheKey)
        if (cached) {
            setJornadas(cached)
            setLoading(false)
            return
        }

        const controller = new AbortController()

        const load = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/jornadas?empleado_id=${employee.id}&inicio=${period.start}&fin=${period.end}`, { signal: controller.signal })
                const data = await res.json()

                const relevant = (Array.isArray(data) ? data : [])
                    .filter((j) => {
                        if (period.start && j.fecha < period.start) return false
                        if (period.end && j.fecha > period.end) return false

                        const h = j.horas_extra_hhmm || {}
                        return Object.values(h.breakdown || {}).some((v) => v > 0) ||
                            Object.values(h.breakdown?.overtime || {}).some((v) => v > 0) ||
                            Object.values(h.breakdown?.surcharges || {}).some((v) => v > 0) ||
                            (h.fragments && h.fragments.length > 0)
                    })
                    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

                dataCacheRef.current.set(cacheKey, relevant)
                setJornadas(relevant)
            } catch (e) {
                if (e?.name !== "AbortError") {
                    console.error(e)
                }
            } finally {
                setLoading(false)
            }
        }

        load()

        return () => controller.abort()
    }, [isOpen, employee, period])

    const { totalGrossMinutes, totalBankedMinutes } = useMemo(() => {
        return jornadas.reduce((acc, j) => {
            const h = j.horas_extra_hhmm || {}
            const banked = j.desglose_compensacion || {}

            let gross = 0
            const flatGross = { ...h.breakdown, ...(h.breakdown?.overtime || {}), ...(h.breakdown?.surcharges || {}) }
            Object.values(flatGross).forEach((v) => { if (typeof v === "number") gross += v })

            let bankedSum = 0
            Object.values(banked).forEach((v) => { if (typeof v === "number") bankedSum += v })

            return {
                totalGrossMinutes: acc.totalGrossMinutes + gross,
                totalBankedMinutes: acc.totalBankedMinutes + bankedSum,
            }
        }, { totalGrossMinutes: 0, totalBankedMinutes: 0 })
    }, [jornadas])

    const formatTime = (minutes) => {
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        return `${h}h ${m}m`
    }

    const getHours = (j) => {
        const h = j.horas_extra_hhmm || {}
        const flat = { ...h.breakdown }
        if (h.breakdown?.overtime) Object.assign(flat, h.breakdown.overtime)
        if (h.breakdown?.surcharges) Object.assign(flat, h.breakdown.surcharges)

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

    const toAmPm = (time) => {
        if (!time) return ""
        const [h, m] = time.split(":")
        const hour = parseInt(h, 10)
        const ampm = hour >= 12 ? "PM" : "AM"
        const hour12 = hour % 12 || 12
        return `${hour12}:${m} ${ampm}`
    }

    const formatDate = (dateStr) => {
        if (!dateStr) return ""
        const [y, m, d] = dateStr.split("-")
        return new Date(y, m - 1, d).toLocaleDateString()
    }

    const netPayableMinutes = totalGrossMinutes - totalBankedMinutes
    const handlePrint = () => {
        window.print()
    }


    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 flex justify-center items-start print:p-0 print:bg-white print:block print:overflow-visible print:static print:z-auto">
            <style jsx global>{`
                @media print {
                    @page { margin: 5mm; size: auto; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    body * { visibility: hidden; }
                    #approval-format-content, #approval-format-content * { visibility: visible; }
                    #approval-format-content {
                        position: fixed;
                        left: 20px;
                        top: 10px;
                        width: 100%;
                        height: 100%;
                        margin: 0 !important;
                        padding: 0 !important;
                        border: none !important;
                        transform: scale(0.95);
                        transform-origin: top left;
                        background: white;
                        z-index: 9999;
                    }
                }
            `}</style>

            <div className="bg-white text-black w-full max-w-5xl shadow-2xl rounded-sm p-4 my-8 relative print:shadow-none print:w-full print:max-w-none print:my-0 print:p-0 print:border-none">
                <div className="flex justify-between mb-4 print:hidden">
                    <h2 className="text-xl font-bold">Vista Preliminar del Formato</h2>
                    <button onClick={onClose} className="p-2 hover: rounded-full transition-colors" title="Cerrar (Esc)">
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div id="approval-format-content" className="border border-black p-1 w-full max-w-[210mm] mx-auto bg-white print:border-0 overflow-x-auto print:overflow-visible">
                    <div className="border border-black flex">
                        <div className="w-32 border-r border-black p-2 flex items-center justify-center">
                            <img src="/assets/logo.png" alt="Logo Tribunas" className="w-full h-auto object-contain max-h-24" />
                        </div>
                        <div className="flex-1 text-center p-2 flex flex-col justify-center">
                            <h1 className="font-bold text-lg leading-tight">LA ASOCIACION DE SUSCRIPTORES DE LA EMPRESA DE SERVICIOS TRIBUNAS CORCEGA E.S.P. <br /> NIT. 816.003.198-3</h1>
                            <p className="text-xs mt-1">VIGILADA POR LA SUPERINTENDENCIA DE SERVICIOS PUBLICOS - SSP ID. 3013</p>
                            <h2 className="font-bold text-md mt-2 border-t border-black pt-1 block w-full">REGISTRO DE HORA EXTRA</h2>
                        </div>
                        <div className="w-51 border-l border-black text-[14px]">
                            <div className="border-b border-black p-1">Codigo: GA - AP - R - RHE - 01</div>
                            <div className="border-b border-black p-1">Fecha creacion: 30 abril 2014</div>
                            <div className="p-1">Fecha actualizacion: 1 julio 2017</div>
                        </div>
                    </div>

                    <div className="border border-t-0 border-black text-sm">
                        <div className="flex border-b border-black">
                            <div className="w-48 font-bold p-1 border-r border-black ">NOMBRE DEL EMPLEADO</div>
                            <div className="p-1 px-2 flex-1 uppercase">{employee?.nombre}</div>
                        </div>
                        <div className="flex">
                            <div className="w-48 font-bold p-1 border-r border-black ">FECHA DE AUTORIZACION</div>
                            <div className="p-1 px-2 flex-1">{new Date().toLocaleDateString()}</div>
                        </div>
                    </div>

                    <div className="mt-4 min-h-[400px]">
                        <table className="w-full border-collapse border border-black text-[10px] md:text-xs">
                            <thead>
                                <tr>
                                    <th className="border border-black p-1 w-24">FECHA</th>
                                    <th className="border border-black p-1 w-24">DESDE LAS</th>
                                    <th className="border border-black p-1 w-24">HASTA LAS</th>
                                    <th className="border border-black p-1">HORAS EXTRA / RECARGOS</th>
                                    <th className="border border-black p-1 w-1/3">JUSTIFICACION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && <tr><td colSpan="5" className="p-4 text-center">Cargando datos...</td></tr>}
                                {!loading && jornadas.length === 0 && <tr><td colSpan="5" className="p-8 text-center italic">No se registraron horas extra en este periodo.</td></tr>}
                                {jornadas.map((j) => {
                                    const fragments = j.horas_extra_hhmm?.fragments
                                    if (fragments && fragments.length > 0) {
                                        return fragments.map((frag, idx) => (
                                            <tr key={`${j.id}-${idx}`}>
                                                <td className="border border-black p-1 text-center">{formatDate(j.fecha)}</td>
                                                <td className="border border-black p-1 text-center">{toAmPm(frag.startTime)}</td>
                                                <td className="border border-black p-1 text-center">{toAmPm(frag.endTime)}</td>
                                                <td className="border border-black p-1 text-xs text-center">
                                                    {LABELS[frag.type] || frag.type}
                                                    {frag.minutes > 0 && ` (${Math.floor(frag.minutes / 60)}h ${frag.minutes % 60}m / ${(frag.minutes / 60).toFixed(2)})`}
                                                </td>
                                                <td className="border border-black p-1 text-xs">{idx === 0 ? (j.observaciones || "") : ""}</td>
                                            </tr>
                                        ))
                                    }

                                    let entry = ""
                                    let exit = ""
                                    if (j.jornada_base_calcular) {
                                        const schedule = j.jornada_base_calcular
                                        if (schedule.morning?.enabled) entry = schedule.morning.start
                                        else if (schedule.afternoon?.enabled) entry = schedule.afternoon.start
                                        if (schedule.afternoon?.enabled) exit = schedule.afternoon.end
                                        else if (schedule.morning?.enabled) exit = schedule.morning.end
                                    }

                                    return (
                                        <tr key={j.id}>
                                            <td className="border border-black p-1 text-center">{formatDate(j.fecha)}</td>
                                            <td className="border border-black p-1 text-center">{toAmPm(entry)}</td>
                                            <td className="border border-black p-1 text-center">{toAmPm(exit)}</td>
                                            <td className="border border-black p-1 text-xs">{getHours(j)}</td>
                                            <td className="border border-black p-1 text-xs">{j.observaciones || ""}</td>
                                        </tr>
                                    )
                                })}
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

                    <div className="border border-black border-t-0 p-1 font-bold text-sm">
                        <div className="flex border-b border-black/20 pb-1 mb-1">
                            <div className="w-[60%] text-gray-700">TOTAL HORAS TRABAJADAS (BRUTO)</div>
                            <div className="flex-1 text-right px-4 text-gray-700">{formatTime(totalGrossMinutes)} / {(totalGrossMinutes / 60).toFixed(2)}</div>
                        </div>
                        {totalBankedMinutes > 0 && (
                            <div className="flex border-b border-black/20 pb-1 mb-1 text-red-600">
                                <div className="w-[60%] pl-4">- MENOS: HORAS COMPENSADAS EN TIEMPO</div>
                                <div className="flex-1 text-right px-4">({formatTime(totalBankedMinutes)} / {(totalBankedMinutes / 60).toFixed(2)})</div>
                            </div>
                        )}
                        <div className="flex py-1">
                            <div className="w-[60%] text-black uppercase">TOTAL A PAGAR EN NOMINA (NETO)</div>
                            <div className="flex-1 text-right px-4 text-black border-black">{formatTime(netPayableMinutes)} / {(netPayableMinutes / 60).toFixed(2)}</div>
                        </div>
                    </div>

                    <div className="mt-16 mb-8 flex justify-between px-10">
                        <div className="text-center w-64">
                            <div className="border-b border-black mb-2 h-16"></div>
                            <div className="font-bold text-sm">GERENTE</div>
                        </div>
                        <div className="text-center w-64">
                            <div className="border-b border-black mb-2 h-16"></div>
                            <div className="font-bold text-sm">COORDINADOR RESPONSABLE</div>
                        </div>
                    </div>

                    <div className="text-center text-[10px] mt-8 mb-4">
                        Kilometro 5 via Armenia Vereda Huertas, Telefonos: 3119762 - 3119733<br />
                        E-mail: esptricorc@yahoo.es
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 print:hidden bg-gray-50 p-4 rounded border-t border-gray-200">
                    <button onClick={handlePrint} className="px-4 py-2 border border-blue-300 text-blue-700 rounded hover:bg-blue-50 font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        Imprimir / Guardar PDF
                    </button>
                    <button onClick={onClose} className="px-4 py-2 border border-input rounded hover:bg-accent font-medium">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    )
}






