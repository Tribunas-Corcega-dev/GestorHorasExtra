
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

/**
 * Calculates the monetary value of a specific overtime duration.
 * @param {number} minutes - Duration in minutes
 * @param {number} hourlyRate - Employee's hourly rate
 * @param {number} surchargePercentage - Surcharge percentage (e.g., 25 for 25%)
 * @returns {number} Calculated value
 */
export function calculateOvertimeValue(minutes, hourlyRate, surchargePercentage) {
    if (!minutes || !hourlyRate) return 0

    const hours = minutes / 60
    // Formula: Hours * HourlyRate * (1 + Surcharge/100)
    // Wait, usually the surcharge is ON TOP of the base hour if it's extra time.
    // If it's a surcharge (recargo), it's just the extra part.
    // But for "Horas Extra", it's usually the full value (1.25x).
    // Let's assume the percentage stored is the EXTRA part (e.g. 25).
    // So the factor is 1 + (25/100) = 1.25.

    const factor = 1 + (surchargePercentage / 100)
    return hours * hourlyRate * factor
}

/**
 * Calculates the total monetary value for a breakdown of overtime.
 * @param {object} breakdown - Object with minutes per type
 * @param {number} hourlyRate - Employee's hourly rate
 * @param {array} surcharges - Array of surcharge objects from DB
 * @returns {number} Total value
 */
export function calculateTotalOvertimeValue(breakdown, hourlyRate, surcharges) {
    if (!breakdown || !hourlyRate || !surcharges) return 0

    let totalValue = 0

    Object.entries(breakdown).forEach(([type, minutes]) => {
        if (minutes > 0) {
            // Find the surcharge percentage for this type
            // The type in breakdown matches the key in DB? 
            // DB has 'tipo_hora_extra' like 'Extra Diurna'.
            // Breakdown keys are 'extra_diurna'. 
            // We need a mapping or flexible search.

            // Let's map keys to DB names or assume we pass a map.
            // Better to normalize here.
            const surcharge = surcharges.find(s => normalizeType(s.tipo_hora_extra) === type)
            const percentage = surcharge ? surcharge.recargo : 0

            totalValue += calculateOvertimeValue(minutes, hourlyRate, percentage)
        }
    })

    return totalValue
}

function normalizeType(dbType) {
    // Map DB display names to breakdown keys
    const map = {
        "Extra Diurna": "extra_diurna",
        "Extra Nocturna": "extra_nocturna",
        "Extra Diurna Festivo": "extra_diurna_festivo",
        "Extra Nocturna Festivo": "extra_nocturna_festivo",
        "Recargo Nocturno": "recargo_nocturno",
        "Dominical/Festivo": "dominical_festivo",
        "Recargo Nocturno Festivo": "recargo_nocturno_festivo"
    }
    return map[dbType] || dbType
}
