
// Simulating Overtime Calculation Logic

// Since I cannot easily import the hook code directly in node without setup, I will copy the RELEVANT logic here to test it in isolation.
// This ensures we test the ALGORITHM, not the environment.

function calculateOvertimeForDayShim(recordedSchedule, fixedScheduleDay, nightShiftRange, isFestivo) {
    // --- COPY PASTE FROM useOvertimeCalculator.js Core Logic ---
    // 1. Get Intervals
    const recordedIntervals = getIntervals(recordedSchedule)
    const fixedIntervals = fixedScheduleDay ? getIntervals(fixedScheduleDay) : []
    const nightIntervals = getNightIntervals(nightShiftRange)

    // 2. Total
    const totalRecordedMinutes = calculateTotalMinutes(recordedIntervals)

    // 3. Ordinary vs Extra
    // Ordinary = Intersection
    const ordinaryIntervals = intersectIntervalsList(recordedIntervals, fixedIntervals)

    // Extra = Recorded - Fixed
    const extraIntervals = subtractIntervalsList(recordedIntervals, fixedIntervals)

    // 4. Classify
    const extraNightIntervals = intersectIntervalsList(extraIntervals, nightIntervals)
    const extraNightMinutes = calculateTotalMinutes(extraNightIntervals)

    const extraDayIntervals = subtractIntervalsList(extraIntervals, nightIntervals)
    const extraDayMinutes = calculateTotalMinutes(extraDayIntervals)

    const ordinaryNightIntervals = intersectIntervalsList(ordinaryIntervals, nightIntervals)
    const ordinaryNightMinutes = calculateTotalMinutes(ordinaryNightIntervals)

    const ordinaryDayIntervals = subtractIntervalsList(ordinaryIntervals, nightIntervals)
    const ordinaryDayMinutes = calculateTotalMinutes(ordinaryDayIntervals)

    const breakdown = {
        extra_diurna: 0,
        extra_nocturna: 0,
        extra_diurna_festivo: 0,
        extra_nocturna_festivo: 0,
        recargo_nocturno: 0,
        dominical_festivo: 0,
        recargo_nocturno_festivo: 0
    }

    if (isFestivo) {
        breakdown.extra_diurna_festivo = extraDayMinutes
        breakdown.extra_nocturna_festivo = extraNightMinutes
        breakdown.dominical_festivo = ordinaryDayMinutes
        breakdown.recargo_nocturno_festivo = ordinaryNightMinutes
    } else {
        breakdown.extra_diurna = extraDayMinutes
        breakdown.extra_nocturna = extraNightMinutes
        breakdown.recargo_nocturno = ordinaryNightMinutes
    }

    return { breakdown, ordinaryDayMinutes, ordinaryNightMinutes, extraDayMinutes, extraNightMinutes }
}

// --- Helpers ---
function timeToMinutes(timeStr) {
    if (!timeStr) return 0
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
}

function getIntervals(schedule) {
    if (!schedule) return []
    if (schedule.enabled === false) return []
    const intervals = []
    if (schedule.morning?.enabled && schedule.morning.start && schedule.morning.end) {
        intervals.push({ start: timeToMinutes(schedule.morning.start), end: timeToMinutes(schedule.morning.end) })
    }
    if (schedule.afternoon?.enabled && schedule.afternoon.start && schedule.afternoon.end) {
        intervals.push({ start: timeToMinutes(schedule.afternoon.start), end: timeToMinutes(schedule.afternoon.end) })
    }
    return intervals.sort((a, b) => a.start - b.start)
}

function getNightIntervals(range) {
    if (!range) range = { start: "21:00", end: "06:00" }
    const start = timeToMinutes(range.start)
    const end = timeToMinutes(range.end)
    if (start <= end) return [{ start, end }]
    return [{ start, end: 1440 }, { start: 0, end }]
}

function calculateTotalMinutes(intervals) {
    return intervals.reduce((acc, curr) => acc + (curr.end - curr.start), 0)
}

function intersectIntervals(a, b) {
    const start = Math.max(a.start, b.start)
    const end = Math.min(a.end, b.end)
    if (start < end) return { start, end }
    return null
}

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

function subtractIntervalsList(listA, listB) {
    let result = [...listA]
    listB.forEach(b => {
        const nextResult = []
        result.forEach(a => {
            if (a.end <= b.start || a.start >= b.end) {
                nextResult.push(a)
            } else {
                if (a.start < b.start) nextResult.push({ start: a.start, end: b.start })
                if (a.end > b.end) nextResult.push({ start: b.end, end: a.end })
            }
        })
        result = nextResult
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
        if (current.start < last.end) last.end = Math.max(last.end, current.end)
        else merged.push(current)
    }
    return merged
}

// --- TEST CASE ---
console.log("Running Reproduction Test...")

// Scenario: Employee works Mon-Sat.
// Sunday is Valid in Fixed Schedule Object (it exists) but ENABLED = FALSE (or empty).

// Recorded Schedule: Sunday 07:30-12:00, 13:45-17:00
const recordedSchedule = {
    enabled: true,
    es_festivo: true, // It is Sunday
    morning: { start: "07:30", end: "12:00", enabled: true },
    afternoon: { start: "13:45", end: "17:00", enabled: true }
}

// Fixed Schedule Day (Sunday) -> Should be empty/disabled for Mon-Sat employee
const fixedScheduleDay = undefined // Case 1: Undefined (key missing)
// const fixedScheduleDay = { enabled: false } // Case 2: Explicitly disabled

console.log("--- Case 1: Fixed Schedule is UNDEFINED ---")
const result1 = calculateOvertimeForDayShim(
    recordedSchedule,
    undefined,
    { start: "21:00", end: "06:00" },
    true // isFestivo
)
console.log("Breakdown:", result1.breakdown)

console.log("\n--- Case 2: Fixed Schedule is { enabled: false } ---")
const result2 = calculateOvertimeForDayShim(
    recordedSchedule,
    { enabled: false },
    { start: "21:00", end: "06:00" },
    true
)
console.log("Breakdown:", result2.breakdown)

console.log("\n--- Case 3: Fixed Schedule IS ENABLED (Simulating the BUG) ---")
// Simulating if the system incorrectly identified Sunday as a Workday
const fixedScheduleDayBug = {
    enabled: true,
    morning: { start: "07:30", end: "12:00", enabled: true },
    afternoon: { start: "13:45", end: "17:00", enabled: true }
}
const result3 = calculateOvertimeForDayShim(
    recordedSchedule,
    fixedScheduleDayBug,
    { start: "21:00", end: "06:00" },
    true
)
console.log("Breakdown:", result3.breakdown)

console.log("\n--- Case 4: Fixed Schedule is { enabled: false } BUT has enabled shifts (Ghost Data) ---")
// This simulates the data condition we suspect causes the bug.
const fixedScheduleGhost = {
    enabled: false,
    morning: { start: "07:30", end: "12:00", enabled: true },
    afternoon: { start: "13:45", end: "17:00", enabled: true }
}
const result4 = calculateOvertimeForDayShim(
    recordedSchedule,
    fixedScheduleGhost,
    { start: "21:00", end: "06:00" },
    true
)
console.log("Breakdown:", result4.breakdown)

console.log("\n--- Case 5: Tuesday Disabled (Ghost Data) - Should be Extra Diurna Normal ---")
// Testing a normal weekday (isFestivo = false) that is disabled in schedule
const result5 = calculateOvertimeForDayShim(
    recordedSchedule,
    fixedScheduleGhost,
    { start: "21:00", end: "06:00" },
    false // isFestivo = false
)
console.log("Breakdown:", result5.breakdown)

console.log("\n--- Case 6: Partial Saturday (Fixed 8-12, Worked 8-16) ---")
const fixedSaturday = {
    enabled: true,
    morning: { start: "08:00", end: "12:00", enabled: true },
    afternoon: { enabled: false }
}
const recordedSaturday = {
    enabled: true,
    morning: { start: "08:00", end: "12:00", enabled: true },
    afternoon: { start: "13:00", end: "16:00", enabled: true } // Worked extra in afternoon
}
const result6 = calculateOvertimeForDayShim(
    recordedSaturday,
    fixedSaturday,
    { start: "21:00", end: "06:00" },
    false
)
// Expectation: 4h Ordinary (8-12), 3h Extra (13-16)
console.log("OrdinaryMins:", result6.ordinayDayMinutes || result6.ordinaryDayMinutes) // typo in result keys? shim returns ordinaryDayMinutes
console.log("ExtraMins:", result6.extraDayMinutes)
console.log("Breakdown:", result6.breakdown)

console.log("\n--- Case 7: Extended Friday (Fixed 7:30-16:15, Worked 7:30-18:00) ---")
const fixedFriday = {
    enabled: true,
    morning: { start: "07:30", end: "12:00", enabled: true },
    afternoon: { start: "13:00", end: "16:15", enabled: true }
}
const recordedFriday = {
    enabled: true,
    morning: { start: "07:30", end: "12:00", enabled: true },
    afternoon: { start: "13:00", end: "18:00", enabled: true }
}
const result7 = calculateOvertimeForDayShim(
    recordedFriday,
    fixedFriday,
    { start: "21:00", end: "06:00" },
    false
)
// Expectation: Ordinary until 16:15. Extra 16:15-18:00 (105 mins)
console.log("ExtraMins:", result7.extraDayMinutes)
console.log("Breakdown:", result7.breakdown)
