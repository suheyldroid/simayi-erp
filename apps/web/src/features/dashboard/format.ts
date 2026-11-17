import { locale } from '@/lib/i18n'

const monthKeyPattern = /^(\d{4})-(\d{2})$/

const monthFormat = new Intl.DateTimeFormat(locale, {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const dayFormat = new Intl.DateTimeFormat(locale, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

/**
 * Formats an API `YYYY-MM` month key in the display locale using a fixed UTC
 * date, so the label can never shift across time zones. Unknown values stay
 * verbatim.
 */
export function monthLabel(month: string) {
  const match = monthKeyPattern.exec(month)
  if (!match) return month
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) return month
  return monthFormat.format(new Date(Date.UTC(year, monthIndex, 1)))
}

/** Month and year for a zero-based month index and a full year. */
export function monthYearLabel(monthIndex: number, year: number) {
  return monthFormat.format(new Date(Date.UTC(year, monthIndex, 1)))
}

/** Day and month without a year; the year never affects the short form. */
export function dayMonthLabel(monthIndex: number, day: number) {
  return dayFormat.format(new Date(Date.UTC(2000, monthIndex, day)))
}

/** Locale-digit formatting for the real integer counts the API returns. */
export function formatCount(value: number) {
  return value.toLocaleString(locale)
}

const timestampFormat = new Intl.DateTimeFormat(locale, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

/** An API `date-time` in the display locale; an invalid value stays raw. */
export function utcTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return timestampFormat.format(date)
}

/** Range covered by the monthly series, oldest to newest; null when empty. */
export function monthRangeLabel(months: string[]) {
  const first = months[0]
  const last = months[months.length - 1]
  if (!first || !last) return null
  const start = monthLabel(first)
  const end = monthLabel(last)
  return start === end ? start : `${start} – ${end}`
}
