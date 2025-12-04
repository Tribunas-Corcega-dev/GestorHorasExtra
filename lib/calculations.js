
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

    // Handle percentage: if < 2, assume it's a factor (e.g. 0.25). If > 2, assume percentage (e.g. 25).
    const percentage = surchargePercentage > 2 ? surchargePercentage / 100 : surchargePercentage

    // If it's overtime (Extra), we pay Base (1) + Surcharge (percentage).
    // If it's surcharge (Recargo), we pay only Surcharge (percentage) because Base is in salary.
    // User requested formula: valor_hora + (valor_hora * recargo) => 1 + percentage
    const factor = 1 + percentage

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
            const surcharge = surcharges.find(s => normalizeType(s.tipo_hora_extra) === type)
            const percentage = surcharge ? surcharge.recargo : 0

            // Determine if it's Overtime (Extra) or Surcharge (Recargo)
            // Keys starting with 'extra_' are Overtime. Others are Surcharges.
            // const isOvertime = type.startsWith('extra_')

            totalValue += calculateOvertimeValue(minutes, hourlyRate, percentage)
        }
    })

    return totalValue
}

function normalizeType(dbType) {
    if (!dbType) return ""
    // Map DB display names to breakdown keys
    // Keys are the DB 'tipo_hora_extra', Values are our internal keys
    const map = {
        "Extra diurno": "extra_diurna",
        "Extra Diurna": "extra_diurna",
        "Trabajo extra nocturno": "extra_nocturna",
        "Extra Nocturna": "extra_nocturna",
        "Trabajo extra diurno dominical y festivo": "extra_diurna_festivo",
        "Extra Diurna Festivo": "extra_diurna_festivo",
        "Trabajo extra nocturno en domingos y festivos": "extra_nocturna_festivo",
        "Extra Nocturna Festivo": "extra_nocturna_festivo",
        "Recargo Nocturno": "recargo_nocturno",
        "Trabajo nocturno": "recargo_nocturno",
        "Trabajo dominical y festivo": "dominical_festivo",
        "Dominical/Festivo": "dominical_festivo",
        "Trabajo nocturno en dominical y festivo": "recargo_nocturno_festivo",
        "Recargo Nocturno Festivo": "recargo_nocturno_festivo"
    }
    return map[dbType] || dbType
}
