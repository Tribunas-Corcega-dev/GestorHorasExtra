import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a YYYY-MM-DD date string for display in the local timezone.
 * Prevents the "one day behind" issue caused by UTC parsing.
 */
export function formatDateForDisplay(dateString: string) {
  if (!dateString) return "-"
  const [year, month, day] = dateString.split('-').map(Number)
  // Create date as local time (months are 0-indexed)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString()
}
