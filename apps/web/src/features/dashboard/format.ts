const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * Formats an API `YYYY-MM` month key without constructing a Date, so the label
 * can never shift across time zones. Unknown values stay verbatim.
 */
export function monthLabel(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return month
  const year = match[1]
  const index = Number(match[2]) - 1
  const name = MONTH_NAMES[index]
  if (!year || !name) return month
  return `${name} ${year}`
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
