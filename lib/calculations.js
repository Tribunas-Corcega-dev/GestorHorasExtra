
/**
 * Converts a time string (HH:MM) to minutes.
 * @param {string} timeStr 
 * @returns {number} minutes
 */
function timeToMinutes(timeStr) {
    if (!timeStr) return 0
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
}

/**
 * Calculates the duration in minutes between two time strings.
 * @param {string} start 
 * @param {string} end 
 * @returns {number} duration in minutes
 */
function calculateDuration(start, end) {
    if (!start || !end) return 0
    const startMin = timeToMinutes(start)
    const endMin = timeToMinutes(end)
    return Math.max(0, endMin - startMin)
}

/**
 * Calculates employee work values based on schedule and salary.
 * @param {object} schedule - The employee's fixed schedule (jornada_fija_hhmm)
 * @param {number} salary - The employee's base salary
 * @returns {object} { horas_semanales, horas_mensuales, valor_hora }
 */
export function calculateEmployeeWorkValues(schedule, salary) {
    if (!schedule || typeof schedule !== 'object') {
        return {
            horas_semanales: 0,
            horas_mensuales: 0,
            valor_hora: 0
        }
    }

    let weeklyMinutes = 0
    let workDays = 0

    // Iterate over days to calculate total weekly minutes and count work days
    Object.values(schedule).forEach(day => {
        if (day.enabled) {
            workDays++

            if (day.morning?.enabled) {
                weeklyMinutes += calculateDuration(day.morning.start, day.morning.end)
            }

            if (day.afternoon?.enabled) {
                weeklyMinutes += calculateDuration(day.afternoon.start, day.afternoon.end)
            }
        }
    })

    const weeklyHours = weeklyMinutes / 60

    // Avoid division by zero
    if (workDays === 0) {
        return {
            horas_semanales: 0,
            horas_mensuales: 0,
            valor_hora: 0
        }
    }

    // Formula: (WeeklyHours / WorkDays) * 30
    const monthlyHours = (weeklyHours / workDays) * 30

    // Calculate hourly rate
    // If monthlyHours is 0, avoid infinity
    const hourlyRate = monthlyHours > 0 ? (Number(salary) / monthlyHours) : 0

    return {
        horas_semanales: parseFloat(weeklyHours.toFixed(2)),
        horas_mensuales: parseFloat(monthlyHours.toFixed(2)),
        valor_hora: parseFloat(hourlyRate.toFixed(2))
    }
}
