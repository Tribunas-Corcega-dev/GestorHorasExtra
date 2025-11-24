import { useState, useEffect } from "react"

export function useOvertimeCalculator(employeeId) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [calculations, setCalculations] = useState([])
    const [summary, setSummary] = useState({
        totalOvertimeMinutes: 0,
        totalOvertimeHours: "00:00"
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

            // 2. Fetch Jornadas (Recorded Shifts)
            const jornadasRes = await fetch(`/api/jornadas?empleado_id=${employeeId}`)
            if (!jornadasRes.ok) throw new Error("Error fetching jornadas")
            const jornadas = await jornadasRes.json()

            // 3. Calculate Overtime
            const results = jornadas.map(jornada => {
                const dayId = getDayId(jornada.fecha)
                const fixedDay = fixedSchedule ? fixedSchedule[dayId] : null

                // Get intervals for both schedules
                const recordedIntervals = getIntervals(jornada.jornada_base_calcular)
                const fixedIntervals = fixedDay ? getIntervals(fixedDay) : []

                // Calculate total minutes worked (recorded)
                const recordedMinutes = calculateTotalMinutes(recordedIntervals)

                // Calculate expected minutes (fixed)
                const expectedMinutes = calculateTotalMinutes(fixedIntervals)

                // Calculate Overlap (Minutes worked WITHIN fixed schedule)
                let overlapMinutes = 0
                recordedIntervals.forEach(recorded => {
                    fixedIntervals.forEach(fixed => {
                        overlapMinutes += getOverlap(recorded, fixed)
                    })
                })

                // Overtime = Total Recorded - Overlap
                // Any minute worked that is NOT in the overlap is overtime.
                const overtimeMinutes = Math.max(0, recordedMinutes - overlapMinutes)

                return {
                    id: jornada.id,
                    date: jornada.fecha,
                    dayId,
                    recordedMinutes,
                    expectedMinutes,
                    overtimeMinutes,
                    formattedOvertime: formatMinutesToHHMM(overtimeMinutes),
                    schedule: jornada.jornada_base_calcular
                }
            })

            // 4. Summarize
            const totalMinutes = results.reduce((acc, curr) => acc + curr.overtimeMinutes, 0)

            setCalculations(results)
            setSummary({
                totalOvertimeMinutes: totalMinutes,
                totalOvertimeHours: formatMinutesToHHMM(totalMinutes)
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

// Helper Functions

function getDayId(dateString) {
    const date = new Date(dateString)
    const dayIndex = date.getUTCDay() // 0-6, 0=Sun
    const map = {
        0: 'domingo',
        1: 'lunes',
        2: 'martes',
        3: 'miercoles',
        4: 'jueves',
        5: 'viernes',
        6: 'sabado'
    }
    return map[dayIndex]
}

function getIntervals(schedule) {
    if (!schedule) return []
    const intervals = []

    if (schedule.morning?.enabled && schedule.morning.start && schedule.morning.end) {
        intervals.push({
            start: timeToMinutes(schedule.morning.start),
            end: timeToMinutes(schedule.morning.end)
        })
    }

    if (schedule.afternoon?.enabled && schedule.afternoon.start && schedule.afternoon.end) {
        intervals.push({
            start: timeToMinutes(schedule.afternoon.start),
            end: timeToMinutes(schedule.afternoon.end)
        })
    }
    return intervals
}

function calculateTotalMinutes(intervals) {
    return intervals.reduce((acc, curr) => acc + (curr.end - curr.start), 0)
}

function getOverlap(range1, range2) {
    const start = Math.max(range1.start, range2.start)
    const end = Math.min(range1.end, range2.end)
    return Math.max(0, end - start)
}

function timeToMinutes(timeStr) {
    if (!timeStr) return 0
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
}

function formatMinutesToHHMM(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}
