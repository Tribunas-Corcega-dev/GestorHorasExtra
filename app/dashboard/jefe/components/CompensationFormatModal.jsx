"use client"

import { useEffect, useMemo, useState } from "react"

export function CompensationFormatModal({ isOpen, onClose, employee, period }) {
    const [historial, setHistorial] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const handleEsc = (e) => { if (e.key === "Escape") onClose() }
        window.addEventListener("keydown", handleEsc)
        return () => window.removeEventListener("keydown", handleEsc)
    }, [onClose])

    useEffect(() => {
        if (!isOpen || !employee?.id) return
        const controller = new AbortController()

        const load = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/compensatorios/saldo?userId=${employee.id}`, { signal: controller.signal })
                const data = await res.json()
                let items = data?.historial || []

                if (period?.start && period?.end) {
                    items = items.filter((h) => {
                        const f = h.fecha ? h.fecha.split("T")[0] : null
                        if (!f) return false
                        return f >= period.start && f <= period.end
                    })
                }

                items = items.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
                setHistorial(items)
            } catch (e) {
                if (e?.name !== "AbortError") console.error(e)
            } finally {
                setLoading(false)
            }
        }

        load()
        return () => controller.abort()
    }, [isOpen, employee, period])

    const { totalAcumulado, totalUsado } = useMemo(() => {
        return historial.reduce((acc, h) => {
            if (h.tipo_operacion === "ACUMULACION") acc.totalAcumulado += h.cantidad_minutos || 0
            if (h.tipo_operacion === "USO") acc.totalUsado += h.cantidad_minutos || 0
            return acc
        }, { totalAcumulado: 0, totalUsado: 0 })
    }, [historial])

    const formatTime = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "")
    const saldoFinal = historial.length > 0 ? historial[historial.length - 1].saldo_nuevo : 0
    const handlePrint = () => window.print()

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 flex justify-center items-start print:p-0 print:bg-white print:block print:overflow-visible print:static print:z-auto">
            <style jsx global>{`
                @media print {
                    @page { margin: 5mm; size: auto; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    body * { visibility: hidden; }
                    #compensation-format-content, #compensation-format-content * { visibility: visible; }
                    #compensation-format-content {
                    position: fixed; left: 20px; top: 10px; width: 100%; height: 100%;
                    margin: 0 !important; padding: 0 !important; border: none !important;
                    transform: scale(0.95);
                    transform-origin: top left;
                    background: white;
                    z-index: 9999;
                }
                }
            `}</style>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8 print:shadow-none print:rounded-none print:max-w-none print:my-0">
                <div id="compensation-format-content" className="border border-black p-1 w-full max-w-[210mm] mx-auto bg-white print:border-0 overflow-x-auto print:overflow-visible">
                    <div className="border border-black flex">
                        <div className="w-32 border-r border-black p-2 flex items-center justify-center">
                            <img src="/assets/logo.png" alt="Logo Tribunas" className="w-full h-auto object-contain max-h-24" />
                        </div>
                        <div className="flex-1 text-center p-2 flex flex-col justify-center">
                            <h1 className="font-bold text-lg leading-tight">LA ASOCIACION DE SUSCRIPTORES DE LA EMPRESA DE SERVICIOS TRIBUNAS CORCEGA E.S.P. <br /> NIT. 816.003.198-3</h1>
                            <p className="text-xs mt-1">VIGILADA POR LA SUPERINTENDENCIA DE SERVICIOS PUBLICOS - SSP ID. 3013</p>
                            <h2 className="font-bold text-md mt-2 border-t border-black pt-1 block w-full">REGISTRO DE COMPENSACIÓN EN TIEMPO</h2>
                        </div>
                        <div className="w-51 border-l border-black text-[14px]">
                            <div className="border-b border-black p-1">Codigo: GA - AP - R - RCT - 01</div>
                            <div className="p-1">Fecha generación: {new Date().toLocaleDateString()}</div>
                        </div>
                    </div>

                    <div className="border border-t-0 border-black text-sm">
                        <div className="flex border-b border-black">
                            <div className="w-48 font-bold p-1 border-r border-black">NOMBRE DEL EMPLEADO</div>
                            <div className="p-1 px-2 flex-1 uppercase">{employee?.nombre}</div>
                        </div>
                    </div>

                    <div className="mt-4 min-h-[300px]">
                        <table className="w-full border-collapse border border-black text-[10px] md:text-xs">
                            <thead>
                                <tr>
                                    <th className="border border-black p-1 w-28">FECHA</th>
                                    <th className="border border-black p-1 w-32">MOVIMIENTO</th>
                                    <th className="border border-black p-1 w-24">MINUTOS</th>
                                    <th className="border border-black p-1 w-24">SALDO RESULTANTE</th>
                                    <th className="border border-black p-1">OBSERVACIÓN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && <tr><td colSpan="5" className="p-4 text-center">Cargando datos...</td></tr>}
                                {!loading && historial.length === 0 && <tr><td colSpan="5" className="p-8 text-center italic">No hay movimientos de compensación en este periodo.</td></tr>}
                                {historial.map((h) => (
                                    <tr key={h.id}>
                                        <td className="border border-black p-1 text-center">{formatDate(h.fecha)}</td>
                                        <td className="border border-black p-1 text-center">{h.tipo_operacion === "ACUMULACION" ? "Acumulación (+)" : "Uso / Redención (-)"}</td>
                                        <td className="border border-black p-1 text-center">{h.cantidad_minutos}</td>
                                        <td className="border border-black p-1 text-center">{formatTime(h.saldo_nuevo)}</td>
                                        <td className="border border-black p-1 text-xs">{h.descripcion || ""}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="border border-black border-t-0 p-1 font-bold text-sm">
                        <div className="flex border-b border-black/20 pb-1 mb-1">
                            <div className="w-[60%] text-gray-700">TOTAL ACUMULADO EN EL PERIODO</div>
                            <div className="flex-1 text-right px-4 text-gray-700">{formatTime(totalAcumulado)}</div>
                        </div>
                        <div className="flex border-b border-black/20 pb-1 mb-1 text-red-600">
                            <div className="w-[60%] pl-4">TOTAL USADO / REDIMIDO</div>
                            <div className="flex-1 text-right px-4">({formatTime(totalUsado)})</div>
                        </div>
                        <div className="flex py-1">
                            <div className="w-[60%] text-black uppercase">SALDO FINAL</div>
                            <div className="flex-1 text-right px-4 text-black">{formatTime(saldoFinal)}</div>
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
                </div>

                <div className="mt-6 flex justify-end gap-3 print:hidden bg-gray-50 p-4 rounded border-t border-gray-200">
                    <button onClick={handlePrint} className="px-4 py-2 border border-blue-300 text-blue-700 rounded hover:bg-blue-50 font-medium">
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