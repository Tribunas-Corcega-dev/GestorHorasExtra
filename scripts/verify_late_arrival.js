
function timeToMinutes(timeStr) {
    if (!timeStr) return 0
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
}

const daySchedule = {
    morning: { enabled: true, start: "08:00", end: "12:00" },
    afternoon: { enabled: true, start: "13:45", end: "17:00" }
}

const intervals = []
if (daySchedule.morning?.enabled) {
    intervals.push({ start: timeToMinutes(daySchedule.morning.start), end: timeToMinutes(daySchedule.morning.end) })
}
if (daySchedule.afternoon?.enabled) {
    intervals.push({ start: timeToMinutes(daySchedule.afternoon.start), end: timeToMinutes(daySchedule.afternoon.end) })
}
intervals.sort((a, b) => a.start - b.start)

console.log("Intervals:", intervals)

const startTimeStr = "08:00"
const arrivalTimeStr = "14:30" // 2:30 PM

const startMin = timeToMinutes(startTimeStr)
const arrivalMin = timeToMinutes(arrivalTimeStr)
const firstStart = intervals[0].start

console.log(`Start: ${startMin}, Arrival: ${arrivalMin}, FirstStart: ${firstStart}`)

let missedMinutes = 0
for (const interval of intervals) {
    // Intersection of (interval) and (firstStart -> arrival)
    const overlapStart = Math.max(interval.start, firstStart)
    const overlapEnd = Math.min(interval.end, arrivalMin)

    console.log(`Checking Interval [${interval.start}, ${interval.end}] against [${firstStart}, ${arrivalMin}]`)
    console.log(`Overlap: [${overlapStart}, ${overlapEnd}]`)

    if (overlapStart < overlapEnd) {
        missedMinutes += (overlapEnd - overlapStart)
        console.log(`Added ${overlapEnd - overlapStart} minutes. Total: ${missedMinutes}`)
    }
}

console.log("Final Missed Minutes:", missedMinutes)
console.log("Formatted:", `${Math.floor(missedMinutes / 60)}h ${missedMinutes % 60}m`)

const simpleDiff = arrivalMin - startMin
console.log("Simple Diff (Wrong):", simpleDiff)
