
/**
 * Converts a time string (HH:MM) to minutes.
 * @param {string} timeStr 
 * @returns {number} minutes
 */
export function timeToMinutes(timeStr) {
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

    // Formula: WeeklyHours * (52 weeks / 12 months) = WeeklyHours * 4.3333...
    // The previous formula (WeeklyHours / WorkDays) * 30 was incorrect for part-time/varied schedules
    const monthlyHours = weeklyHours * 4.3333333333

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

    const normalized = dbType.trim().toLowerCase()
    const map = {
        "extra diurno": "extra_diurna",
        "trabajo extra nocturno": "extra_nocturna",
        "extra nocturna": "extra_nocturna",
        "trabajo extra diurno dominical y festivo": "extra_diurna_festivo",
        "extra diurna festivo": "extra_diurna_festivo",
        "trabajo extra nocturno en domingos y festivos": "extra_nocturna_festivo",
        "extra nocturna festivo": "extra_nocturna_festivo",
        "recargo nocturno": "recargo_nocturno",
        "trabajo nocturno": "recargo_nocturno",
        "trabajo dominical y festivo": "dominical_festivo",
        "dominical/festivo": "dominical_festivo",
        "trabajo nocturno en dominical y festivo": "recargo_nocturno_festivo",
        "recargo nocturno festivo": "recargo_nocturno_festivo"
    }

    return map[normalized] || dbType
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

    const nightIntervals = getNightIntervals(nightShiftRange || { start: "21:00", end: "06:00" })

    // Iterate from start to end
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0]
        const dayOfWeekIndex = d.getUTCDay() // 0 = Sunday
        const dayMap = { 0: 'domingo', 1: 'lunes', 2: 'martes', 3: 'miercoles', 4: 'jueves', 5: 'viernes', 6: 'sabado' }
        const dayKey = dayMap[dayOfWeekIndex]

        const daySchedule = fixedSchedule[dayKey]
        if (!daySchedule || !daySchedule.enabled) continue

        // Get raw intervals (might have start > end for cross-day)
        const rawIntervals = getIntervals(daySchedule)

        rawIntervals.forEach(interval => {
            if (interval.start < interval.end) {
                // Normal same-day shift
                processDayInterval(d, interval, surchargesTotal, nightIntervals, holidays)
            } else {
                // Cross-day shift (e.g., 22:00 -> 06:00)
                // Split into two parts:

                // Part 1: Today (start -> 24:00/1440)
                processDayInterval(d, { start: interval.start, end: 1440 }, surchargesTotal, nightIntervals, holidays)

                // Part 2: Tomorrow (00:00 -> end)
                // We need to calculate tomorrow's date
                const nextDay = new Date(d)
                nextDay.setDate(nextDay.getDate() + 1)

                // Important: Ensure tomorrow is still within the period? 
                // Usually payroll calculation includes the end of the shift even if it spills over.
                // However, strictly speaking, if the period ends on 15th, and shift is 15th 22:00-06:00 (16th),
                // the 16th hours usually belong to the 15th's payroll period logic or are counted.
                // Standard practice: The shift belongs to the day it started.
                // BUT the surcharge TYPE depends on the actual time (Sunday morning vs Monday morning).
                // So checking nextDay properties is correct.
                processDayInterval(nextDay, { start: 0, end: interval.end }, surchargesTotal, nightIntervals, holidays)
            }
        })
    }

    return surchargesTotal
}

function processDayInterval(dateObj, interval, surchargesTotal, nightIntervals, holidays) {
    const dateStr = dateObj.toISOString().split('T')[0]
    const dayOfWeekIndex = dateObj.getUTCDay()
    const isSunday = dayOfWeekIndex === 0
    const isHoliday = holidays.includes(dateStr)
    const isFestivo = isSunday || isHoliday

    const totalMinutes = interval.end - interval.start

    // Calculate Night Minutes for this specific interval
    const nightWorkIntervals = intersectIntervalsList([interval], nightIntervals)
    const nightMinutes = calculateTotalMinutes(nightWorkIntervals)

    // Day Minutes
    const dayMinutes = totalMinutes - nightMinutes

    if (isFestivo) {
        // Holiday/Sunday Rule
        if (dayMinutes > 0) surchargesTotal.dominical_festivo += dayMinutes
        if (nightMinutes > 0) surchargesTotal.recargo_nocturno_festivo += nightMinutes
    } else {
        // Ordinary Day Rule
        if (nightMinutes > 0) surchargesTotal.recargo_nocturno += nightMinutes
    }
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

/**
 * Formats a time string (HH:MM) to 12-hour AM/PM format.
 * @param {string} timeStr - Time in HH:MM format
 * @returns {string} Formatted time (e.g. "02:30 PM")
 */
export function formatToAmPm(timeStr) {
    if (!timeStr) return ""
    const [hours, minutes] = timeStr.split(':').map(Number)
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`
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
