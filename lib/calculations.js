
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

// --- Schedule Surcharge Calculation ---

/**
 * Calculates inherent surcharges (Night, Sunday) for a base schedule.
 * @param {object} schedule - The full weekly schedule object
 * @param {object} nightShiftRange - { start: "HH:MM", end: "HH:MM" }
 * @returns {object} The schedule with added 'surcharges' property for each day
 */
export function calculateScheduleSurcharges(schedule, nightShiftRange) {
    if (!schedule || typeof schedule !== 'object') return schedule

    const enrichedSchedule = JSON.parse(JSON.stringify(schedule)) // Deep copy
    const nightIntervals = getNightIntervals(nightShiftRange || { start: "21:00", end: "06:00" })

    Object.entries(enrichedSchedule).forEach(([dayKey, dayData]) => {
        if (!dayData.enabled) {
            dayData.surcharges = {}
            return
        }

        const intervals = getIntervals(dayData)
        const totalMinutes = calculateTotalMinutes(intervals)

        // Determine if Sunday (based on key or dayOfWeek if available)
        // Keys are usually: lunes, martes, ... domingo
        const isSunday = dayKey.toLowerCase().includes('domingo')

        // Calculate Night Minutes
        const nightWorkIntervals = intersectIntervalsList(intervals, nightIntervals)
        const nightMinutes = calculateTotalMinutes(nightWorkIntervals)

        // Calculate Day Minutes
        const dayMinutes = totalMinutes - nightMinutes

        const surcharges = {}

        if (isSunday) {
            // Sunday: All hours are surcharges
            if (dayMinutes > 0) surcharges.dominical_festivo = dayMinutes
            if (nightMinutes > 0) surcharges.recargo_nocturno_festivo = nightMinutes
        } else {
            // Ordinary Day: Only night hours are surcharges
            if (nightMinutes > 0) surcharges.recargo_nocturno = nightMinutes
        }

        dayData.surcharges = surcharges
    })

    return enrichedSchedule
}

// --- Period Calculation Helpers ---

/**
 * Calculates fixed surcharges for a specific period (range of dates).
 * Iterates through each day, checks if it's a holiday/Sunday, and applies the fixed schedule.
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {object} fixedSchedule - Employee's fixed schedule (jornada_fija_hhmm)
 * @param {object} nightShiftRange - Night shift params
 * @param {array} holidays - Array of date strings ['YYYY-MM-DD', ...]
 * @returns {object} { recargo_nocturno: 0, dominical_festivo: 0, recargo_nocturno_festivo: 0 }
 */
export function calculatePeriodFixedSurcharges(startDate, endDate, fixedSchedule, nightShiftRange, holidays = []) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const surchargesTotal = {
        recargo_nocturno: 0,
        dominical_festivo: 0,
        recargo_nocturno_festivo: 0
    }

    if (!fixedSchedule) return surchargesTotal

    // Iterate from start to end
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        const dayOfWeekIndex = d.getUTCDay() // 0 = Sunday, 1 = Monday...
        const dayMap = { 0: 'domingo', 1: 'lunes', 2: 'martes', 3: 'miercoles', 4: 'jueves', 5: 'viernes', 6: 'sabado' }
        const dayKey = dayMap[dayOfWeekIndex]

        const daySchedule = fixedSchedule[dayKey]

        // If no schedule for this day or disabled, skip
        if (!daySchedule || !daySchedule.enabled) continue

        const isSunday = dayOfWeekIndex === 0
        const isHoliday = holidays.includes(dateStr)
        const isFestivo = isSunday || isHoliday

        // Calculate for this specific day
        // We reuse the logic from calculateScheduleSurcharges but for a single day context
        const intervals = getIntervals(daySchedule)
        const totalMinutes = calculateTotalMinutes(intervals)

        const nightIntervals = getNightIntervals(nightShiftRange || { start: "21:00", end: "06:00" })
        const nightWorkIntervals = intersectIntervalsList(intervals, nightIntervals)
        const nightMinutes = calculateTotalMinutes(nightWorkIntervals)
        const dayMinutes = totalMinutes - nightMinutes

        if (isFestivo) {
            // Holiday/Sunday: All hours are surcharges
            // Day hours -> Dominical/Festivo
            if (dayMinutes > 0) surchargesTotal.dominical_festivo += dayMinutes
            // Night hours -> Recargo Nocturno Festivo
            if (nightMinutes > 0) surchargesTotal.recargo_nocturno_festivo += nightMinutes
        } else {
            // Ordinary Day: Only night hours are surcharges
            if (nightMinutes > 0) surchargesTotal.recargo_nocturno += nightMinutes
        }
    }

    return surchargesTotal
}

// --- Helper Functions (Exported for reuse) ---

export function getIntervals(daySchedule) {
    if (!daySchedule) return []
    const intervals = []
    if (daySchedule.morning?.enabled && daySchedule.morning.start && daySchedule.morning.end) {
        intervals.push({ start: timeToMinutes(daySchedule.morning.start), end: timeToMinutes(daySchedule.morning.end) })
    }
    if (daySchedule.afternoon?.enabled && daySchedule.afternoon.start && daySchedule.afternoon.end) {
        intervals.push({ start: timeToMinutes(daySchedule.afternoon.start), end: timeToMinutes(daySchedule.afternoon.end) })
    }
    return intervals.sort((a, b) => a.start - b.start)
}

export function getNightIntervals(range) {
    if (!range || !range.start || !range.end) return []

    const start = timeToMinutes(range.start)
    const end = timeToMinutes(range.end)

    if (start <= end) {
        return [{ start, end }]
    } else {
        return [
            { start: start, end: 1440 },
            { start: 0, end: end }
        ]
    }
}

export function formatMinutesToHHMM(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.round(totalMinutes % 60)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

export function calculateTotalMinutes(intervals) {
    return intervals.reduce((acc, curr) => acc + (curr.end - curr.start), 0)
}

// --- Interval Math Helpers ---

function intersectIntervals(a, b) {
    const start = Math.max(a.start, b.start)
    const end = Math.min(a.end, b.end)
    if (start < end) return { start, end }
    return null
}

export function intersectIntervalsList(listA, listB) {
    const result = []
    listA.forEach(a => {
        listB.forEach(b => {
            const intersection = intersectIntervals(a, b)
            if (intersection) result.push(intersection)
        })
    })
    return mergeIntervals(result)
}

function mergeIntervals(intervals) {
    if (intervals.length === 0) return []
    const sorted = [...intervals].sort((a, b) => a.start - b.start)
    const merged = [sorted[0]]

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i]
        const last = merged[merged.length - 1]

        if (current.start < last.end) {
            last.end = Math.max(last.end, current.end)
        } else {
            merged.push(current)
        }
    }
    return merged
}
