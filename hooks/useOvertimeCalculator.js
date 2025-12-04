import { useState, useEffect } from "react"

export function useOvertimeCalculator(employeeId) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [calculations, setCalculations] = useState([])
    const [summary, setSummary] = useState({
        totalOvertimeMinutes: 0,
        totalOvertimeHours: "00:00",
        breakdown: {}
    })

    useEffect(() => {
        if (employeeId) {
            calculateOvertime()
        }
    }, [employeeId])

    async function calculateOvertime() {
        setLoading(true)
        setError(null)
        try {
            // 1. Fetch Employee Data (Fixed Schedule)
            const empRes = await fetch(`/api/empleados/${employeeId}`)
            if (!empRes.ok) throw new Error("Error fetching employee data")
            const employee = await empRes.json()

            // Parse fixed schedule if needed
            let fixedSchedule = employee.jornada_fija_hhmm
            if (fixedSchedule && typeof fixedSchedule === 'string') {
                try {
                    fixedSchedule = JSON.parse(fixedSchedule)
                    if (typeof fixedSchedule === 'string') fixedSchedule = JSON.parse(fixedSchedule)
                } catch (e) {
                    console.error("Error parsing fixed schedule:", e)
                    fixedSchedule = null
                }
            }

            // 2. Fetch Parameters (Night Shift)
            const paramRes = await fetch("/api/parametros")
            let nightShiftRange = null
            if (paramRes.ok) {
                const params = await paramRes.json()
                nightShiftRange = params.jornada_nocturna
            }

            // 3. Fetch Jornadas (Recorded Shifts)
            const jornadasRes = await fetch(`/api/jornadas?empleado_id=${employeeId}`)
            if (!jornadasRes.ok) throw new Error("Error fetching jornadas")
            const jornadas = await jornadasRes.json()

            // 4. Calculate Overtime
            const results = jornadas.map(jornada => {
                const dayId = getDayId(jornada.fecha)
                const fixedDay = fixedSchedule ? fixedSchedule[dayId] : null

                // Calculate Overtime using the new logic
                const calculation = calculateOvertimeForDay(
                    jornada.jornada_base_calcular,
                    fixedDay,
                    nightShiftRange,
                    jornada.es_festivo
                );

                return {
                    id: jornada.id,
                    date: jornada.fecha,
                    dayId,
                    ...calculation,
                    schedule: jornada.jornada_base_calcular
                }
            })

            // 5. Summarize
            const totalMinutes = results.reduce((acc, curr) => acc + curr.totalMinutes, 0)
            const totalOvertimeMinutes = results.reduce((acc, curr) => acc + (curr.overtimeMinutes || 0), 0)
            const totalSurchargeMinutes = results.reduce((acc, curr) => acc + (curr.surchargeMinutes || 0), 0)

            // Aggregate breakdown
            const aggregatedBreakdown = {
                overtime: {},
                surcharges: {}
            }

            // Also keep flat for legacy
            const aggregatedFlatBreakdown = {}

            results.forEach(r => {
                // Aggregate structured
                if (r.breakdown?.overtime) {
                    Object.entries(r.breakdown.overtime).forEach(([key, val]) => {
                        aggregatedBreakdown.overtime[key] = (aggregatedBreakdown.overtime[key] || 0) + val
                        aggregatedFlatBreakdown[key] = (aggregatedFlatBreakdown[key] || 0) + val
                    })
                }
                if (r.breakdown?.surcharges) {
                    Object.entries(r.breakdown.surcharges).forEach(([key, val]) => {
                        aggregatedBreakdown.surcharges[key] = (aggregatedBreakdown.surcharges[key] || 0) + val
                        aggregatedFlatBreakdown[key] = (aggregatedFlatBreakdown[key] || 0) + val
                    })
                }

                // Fallback for legacy records if they don't have structured breakdown but have flat breakdown
                if (!r.breakdown?.overtime && !r.breakdown?.surcharges && r.breakdown) {
                    Object.entries(r.breakdown).forEach(([key, val]) => {
                        aggregatedFlatBreakdown[key] = (aggregatedFlatBreakdown[key] || 0) + val
                    })
                }
            })

            setCalculations(results)
            setSummary({
                totalMinutes,
                totalOvertimeMinutes,
                totalSurchargeMinutes,
                totalHours: formatMinutesToHHMM(totalMinutes),
                breakdown: aggregatedBreakdown,
                flatBreakdown: aggregatedFlatBreakdown
            })

        } catch (err) {
            console.error("Error calculating overtime:", err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return { loading, error, calculations, summary, refresh: calculateOvertime }
}

// --- Core Logic ---

export function calculateOvertimeForDay(recordedSchedule, fixedScheduleDay, nightShiftRange, isFestivo) {
    // 1. Get Intervals
    const recordedIntervals = getIntervals(recordedSchedule)
    const fixedIntervals = fixedScheduleDay ? getIntervals(fixedScheduleDay) : []

    // Normalize night shift intervals (handle crossing midnight)
    const nightIntervals = getNightIntervals(nightShiftRange)

    // 2. Calculate Total Worked Minutes
    const totalRecordedMinutes = calculateTotalMinutes(recordedIntervals)

    // 3. Separate Ordinary vs Extra Hours
    // Ordinary = Intersection(Recorded, Fixed)
    const ordinaryIntervals = intersectIntervalsList(recordedIntervals, fixedIntervals)

    // Extra = Recorded - Fixed
    const extraIntervals = subtractIntervalsList(recordedIntervals, fixedIntervals)

    // 4. Classify Hours
    // --- Classify Extra Hours ---
    // Extra Night = Intersection(Extra, Night)
    const extraNightIntervals = intersectIntervalsList(extraIntervals, nightIntervals)
    const extraNightMinutes = calculateTotalMinutes(extraNightIntervals)

    // Extra Day = Extra - Night
    const extraDayIntervals = subtractIntervalsList(extraIntervals, nightIntervals)
    const extraDayMinutes = calculateTotalMinutes(extraDayIntervals)

    // --- Classify Ordinary Hours ---
    // Ordinary Night = Intersection(Ordinary, Night)
    const ordinaryNightIntervals = intersectIntervalsList(ordinaryIntervals, nightIntervals)
    const ordinaryNightMinutes = calculateTotalMinutes(ordinaryNightIntervals)

    // Ordinary Day = Ordinary - Night
    const ordinaryDayIntervals = subtractIntervalsList(ordinaryIntervals, nightIntervals)
    const ordinaryDayMinutes = calculateTotalMinutes(ordinaryDayIntervals)

    const overtimeBreakdown = {
        extra_diurna: 0,
        extra_nocturna: 0,
        extra_diurna_festivo: 0,
        extra_nocturna_festivo: 0
    }

    const surchargesBreakdown = {
        recargo_nocturno: 0,
        dominical_festivo: 0,
        recargo_nocturno_festivo: 0
    }

    if (isFestivo) {
        overtimeBreakdown.extra_diurna_festivo = extraDayMinutes
        overtimeBreakdown.extra_nocturna_festivo = extraNightMinutes

        // All ordinary hours on a holiday are "Dominical/Festivo" related
        surchargesBreakdown.dominical_festivo = ordinaryDayMinutes
        surchargesBreakdown.recargo_nocturno_festivo = ordinaryNightMinutes
    } else {
        overtimeBreakdown.extra_diurna = extraDayMinutes
        overtimeBreakdown.extra_nocturna = extraNightMinutes

        // Normal Day
        surchargesBreakdown.recargo_nocturno = ordinaryNightMinutes
    }

    // Calculate totals
    const overtimeMinutes = Object.values(overtimeBreakdown).reduce((a, b) => a + b, 0)
    const surchargeMinutes = Object.values(surchargesBreakdown).reduce((a, b) => a + b, 0)
    const totalMinutes = overtimeMinutes + surchargeMinutes

    // Legacy flat breakdown for backward compatibility if needed, 
    // but we prefer the structured one.
    const flatBreakdown = { ...overtimeBreakdown, ...surchargesBreakdown }

    return {
        totalMinutes,
        overtimeMinutes,
        surchargeMinutes,
        breakdown: {
            overtime: overtimeBreakdown,
            surcharges: surchargesBreakdown
        },
        // Keep flat breakdown for legacy support in some views if they just iterate keys
        flatBreakdown
    }
}

// --- Helper Functions ---

export function getDayId(dateString) {
    const date = new Date(dateString)
    const dayIndex = date.getUTCDay()
    const map = { 0: 'domingo', 1: 'lunes', 2: 'martes', 3: 'miercoles', 4: 'jueves', 5: 'viernes', 6: 'sabado' }
    return map[dayIndex]
}

export function getIntervals(schedule) {
    if (!schedule) return []
    const intervals = []
    if (schedule.morning?.enabled && schedule.morning.start && schedule.morning.end) {
        intervals.push({ start: timeToMinutes(schedule.morning.start), end: timeToMinutes(schedule.morning.end) })
    }
    if (schedule.afternoon?.enabled && schedule.afternoon.start && schedule.afternoon.end) {
        intervals.push({ start: timeToMinutes(schedule.afternoon.start), end: timeToMinutes(schedule.afternoon.end) })
    }
    return intervals.sort((a, b) => a.start - b.start)
}

export function getNightIntervals(range) {
    if (!range || !range.start || !range.end) return [] // Default or empty

    const start = timeToMinutes(range.start)
    const end = timeToMinutes(range.end)

    if (start <= end) {
        // Same day (e.g., 22:00 - 23:00)
        return [{ start, end }]
    } else {
        // Crosses midnight (e.g., 21:00 - 06:00) -> [21:00, 1440] and [0, 06:00]
        return [
            { start: start, end: 1440 },
            { start: 0, end: end }
        ]
    }
}

export function timeToMinutes(timeStr) {
    if (!timeStr) return 0
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
}

export function formatMinutesToHHMM(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.round(totalMinutes % 60) // Round to nearest minute
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

export function calculateTotalMinutes(intervals) {
    return intervals.reduce((acc, curr) => acc + (curr.end - curr.start), 0)
}

// --- Interval Math ---

// Intersection of two single intervals
function intersectIntervals(a, b) {
    const start = Math.max(a.start, b.start)
    const end = Math.min(a.end, b.end)
    if (start < end) return { start, end }
    return null
}

// Intersection of two lists of intervals
function intersectIntervalsList(listA, listB) {
    const result = []
    listA.forEach(a => {
        listB.forEach(b => {
            const intersection = intersectIntervals(a, b)
            if (intersection) result.push(intersection)
        })
    })
    return mergeIntervals(result)
}

// Subtract listB from listA (A - B)
function subtractIntervalsList(listA, listB) {
    let result = [...listA]

    listB.forEach(b => {
        const nextResult = []
        result.forEach(a => {
            // Subtract b from a
            // Case 1: No overlap
            if (a.end <= b.start || a.start >= b.end) {
                nextResult.push(a)
                return
            }

            // Case 2: Overlap
            // Left part
            if (a.start < b.start) {
                nextResult.push({ start: a.start, end: b.start })
            }
            // Right part
            if (a.end > b.end) {
                nextResult.push({ start: b.end, end: a.end })
            }
        })
        result = nextResult
    })

    return mergeIntervals(result)
}

// Merge overlapping intervals in a list
function mergeIntervals(intervals) {
    if (intervals.length === 0) return []

    // Sort by start time
    const sorted = [...intervals].sort((a, b) => a.start - b.start)

    const merged = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i]
        const last = merged[merged.length - 1]

        if (current.start < last.end) {
            // Overlap, extend last
            last.end = Math.max(last.end, current.end)
        } else {
            // No overlap, add new
            merged.push(current)
        }
    }

    return merged
}
