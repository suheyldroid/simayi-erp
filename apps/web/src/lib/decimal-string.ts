const plainDecimal = /^-?\d+(?:\.\d+)?$/
const maxPlainDecimalLength = 100

type PlainDecimal = {
  negative: boolean
  integerDigits: string
  fractionDigits: string
}

function parsePlainDecimal(value: string): PlainDecimal {
  if (value.length > maxPlainDecimalLength || !plainDecimal.test(value)) {
    throw new Error('Expected a plain decimal string')
  }
  const negative = value.startsWith('-')
  const body = negative ? value.slice(1) : value
  const point = body.indexOf('.')
  if (point < 0) {
    return { negative, integerDigits: body, fractionDigits: '' }
  }
  return {
    negative,
    integerDigits: body.slice(0, point),
    fractionDigits: body.slice(point + 1),
  }
}

function scaledInteger(value: PlainDecimal, scale: number): bigint {
  const fraction = value.fractionDigits.padEnd(scale, '0')
  const digits = `${value.integerDigits}${fraction}`.replace(/^0+/, '')
  const magnitude = BigInt(digits === '' ? '0' : digits)
  return value.negative ? -magnitude : magnitude
}

function formatScaledInteger(value: bigint, scale: number): string {
  if (value === 0n) return '0'
  const negative = value < 0n
  const digits = (negative ? -value : value).toString()
  if (scale === 0) return negative ? `-${digits}` : digits
  const padded = digits.padStart(scale + 1, '0')
  const splitAt = padded.length - scale
  const integerDigits = padded.slice(0, splitAt).replace(/^0+(?=\d)/, '')
  const fractionDigits = padded.slice(splitAt).replace(/0+$/, '')
  const body =
    fractionDigits === '' ? integerDigits : `${integerDigits}.${fractionDigits}`
  return negative ? `-${body}` : body
}

export function subtractDecimalStrings(
  minuend: string,
  subtrahend: string
): string {
  const left = parsePlainDecimal(minuend)
  const right = parsePlainDecimal(subtrahend)
  const scale = Math.max(
    left.fractionDigits.length,
    right.fractionDigits.length
  )
  return formatScaledInteger(
    scaledInteger(left, scale) - scaledInteger(right, scale),
    scale
  )
}

export function isPositiveDecimal(value: string): boolean {
  const parsed = parsePlainDecimal(value)
  if (parsed.negative) return false
  return (
    /[1-9]/.test(parsed.integerDigits) || /[1-9]/.test(parsed.fractionDigits)
  )
}
