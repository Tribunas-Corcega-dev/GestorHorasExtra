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

                // Calculate Recorded Hours
                const recordedMinutes = calculateDailyMinutes(jornada.jornada_base_calcular)

                // Calculate Expected (Fixed) Hours
                const expectedMinutes = fixedDay ? calculateDailyMinutes(fixedDay) : 0

                // Calculate Difference (Overtime)
                // If expected is 0 (rest day), all recorded hours are overtime
                // If recorded > expected, difference is overtime
                // If recorded <= expected, 0 overtime (or negative/undertime if we wanted to track that)

                let overtimeMinutes = 0
                if (recordedMinutes > expectedMinutes) {
                    overtimeMinutes = recordedMinutes - expectedMinutes
                }

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
    const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    // Note: getUTCDay returns 0 for Sunday, 1 for Monday, etc.
    // Our array is 0-indexed starting with Monday? No, let's map correctly.
    // standard getUTCDay: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

    const date = new Date(dateString)
    const dayIndex = date.getUTCDay() // 0-6

    // Map standard index to our ID keys
    // 0 (Sun) -> 'domingo'
    // 1 (Mon) -> 'lunes'
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

function calculateDailyMinutes(schedule) {
    if (!schedule || !schedule.enabled) return 0

    let total = 0

    if (schedule.morning?.enabled && schedule.morning.start && schedule.morning.end) {
        total += getMinutesDiff(schedule.morning.start, schedule.morning.end)
    }

    if (schedule.afternoon?.enabled && schedule.afternoon.start && schedule.afternoon.end) {
        total += getMinutesDiff(schedule.afternoon.start, schedule.afternoon.end)
    }

    return total
}

function getMinutesDiff(start, end) {
    const startMins = timeToMinutes(start)
    const endMins = timeToMinutes(end)
    return Math.max(0, endMins - startMins)
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
