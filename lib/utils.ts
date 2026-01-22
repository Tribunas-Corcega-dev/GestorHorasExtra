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

export const LABELS = {
  extra_diurna: "Extra Diurna",
  extra_nocturna: "Extra Nocturna",
  extra_diurna_festivo: "Extra Diurna Festivo",
  extra_nocturna_festivo: "Extra Nocturna Festivo",
  recargo_nocturno: "Recargo Nocturno",
  dominical_festivo: "Dominical/Festivo",
  recargo_nocturno_festivo: "Recargo Nocturno Festivo"
}
