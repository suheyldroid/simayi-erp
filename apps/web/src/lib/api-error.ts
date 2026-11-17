import { ZodError } from 'zod'
import axios from 'axios'
import { locale, t } from '@/lib/i18n'
import { translateServerTemplate } from '@/lib/server-message'

type ServerError = {
  code?: string
  message?: string
  details?: unknown
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null
  return value as Record<string, unknown>
}

/** API error envelope: `{ error: { code, message, details? } }`. */
function serverError(error: unknown): ServerError | null {
  if (!axios.isAxiosError(error)) return null
  const body = asRecord(error.response?.data)
  if (!body) return null
  const envelope = asRecord(body.error) ?? body
  const code = envelope.code
  const message = envelope.message
  return {
    code: typeof code === 'string' ? code : undefined,
    message: typeof message === 'string' ? message : undefined,
    details: envelope.details,
  }
}

/**
 * Stable English server message → Turkish resource. The lookup keeps the
 * server text as the key, so an unknown message is returned verbatim instead
 * of being replaced by a vague fallback. Known templates the API builds from
 * data (names, currencies, amounts) are anchored separately so their values
 * stay verbatim.
 */
function translatedMessage(message: string | undefined) {
  if (!message) return ''
  return (
    t(message, {
      ns: 'serverMessages',
      nsSeparator: false,
      defaultValue: '',
    }) ||
    translateServerTemplate(message) ||
    ''
  )
}

function translatedCode(code: string | undefined) {
  if (!code) return ''
  return t(`common:serverCodes.${code}`, { defaultValue: '' })
}

/**
 * Translates a known server message or stable code. Returns `undefined` when
 * neither is known, so callers can decide how to surface the original text.
 */
export function translatedServerMessage(message: string, code?: string) {
  return translatedMessage(message) || translatedCode(code) || undefined
}

/** Shortage quantities are canonical decimal strings; they are never parsed. */
function shortageMessage(code: string | undefined, details: unknown) {
  if (code !== 'BUILD_SHORTAGE') return ''
  const record = asRecord(details)
  if (!record || !Array.isArray(record.shortages)) return ''
  const lines = record.shortages.flatMap((entry) => {
    const shortage = asRecord(entry)
    if (!shortage || typeof shortage.componentName !== 'string') return []
    return [
      t('common:errors.stockShortageLine', {
        name: shortage.componentName,
        required: String(shortage.required ?? ''),
        missing: String(shortage.missing ?? ''),
      }),
    ]
  })
  if (lines.length === 0) return ''
  return t('common:errors.stockShortage', { details: lines.join('; ') })
}

function detailSuffix(code: string | undefined, details: unknown) {
  if (code === 'BRANCH_IN_USE') {
    const record = asRecord(details)
    if (!record) return ''
    const keys = [
      'stockBalances',
      'openPurchaseOrders',
      'draftSalesBatches',
      'activePosDevices',
    ] as const
    if (!keys.every((key) => typeof record[key] === 'number')) return ''
    const format = new Intl.NumberFormat(locale)
    return ` ${t('common:errors.branchInUseDetails', {
      stockBalances: format.format(record.stockBalances as number),
      openPurchaseOrders: format.format(record.openPurchaseOrders as number),
      draftSalesBatches: format.format(record.draftSalesBatches as number),
      activePosDevices: format.format(record.activePosDevices as number),
    })}`
  }

  if (code === 'DASHBOARD_INVALID') {
    const record = asRecord(details)
    if (!record || typeof record.path !== 'string') return ''
    return ` ${t('common:errors.dashboardInvalidPath', { path: record.path })}`
  }

  // Validation issues only carry the field paths here: the issue text comes
  // from the schema layer and is not a translatable server contract.
  if (code === 'VALIDATION' && Array.isArray(details)) {
    const paths = details.flatMap((issue) => {
      const record = asRecord(issue)
      if (!record) return []
      const path = record.path
      const value = Array.isArray(path)
        ? path.join('.')
        : typeof path === 'string'
          ? path
          : ''
      return value ? [value] : []
    })
    if (paths.length === 0) return ''
    return ` ${t('common:errors.validationPaths', {
      paths: [...new Set(paths)].join(', '),
    })}`
  }

  return ''
}

function statusMessage(status: number | undefined) {
  if (status) {
    const localized = t(`common:httpStatus.${status}`, { defaultValue: '' })
    if (localized) return localized
  }
  return t('common:errors.operationFailed')
}

/** Native client (Better Auth) errors: a plain `{ message, status, code }`. */
type NativeError = ServerError & { status?: number }

function nativeError(error: unknown): NativeError | null {
  if (error instanceof Error || axios.isAxiosError(error)) return null
  const record = asRecord(error)
  if (!record) return null
  const message = record.message
  const code = record.code
  const status = record.status
  if (typeof message !== 'string' && typeof code !== 'string') return null
  return {
    message: typeof message === 'string' ? message : undefined,
    code: typeof code === 'string' ? code : undefined,
    status: typeof status === 'number' ? status : undefined,
  }
}

/**
 * Human-readable message for any thrown value. Server semantics are preserved:
 * a known stable code or message is translated, an unknown server message is
 * shown as sent, and only a missing message falls back to the HTTP status.
 */
export function errorMessage(error: unknown) {
  if (error instanceof ZodError)
    return error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(' · ')

  const server = serverError(error)
  if (server) {
    const shortage = shortageMessage(server.code, server.details)
    if (shortage) return shortage

    const base =
      translatedMessage(server.message) || translatedCode(server.code)
    if (base) return `${base}${detailSuffix(server.code, server.details)}`
    if (server.message) return server.message
  }

  if (axios.isAxiosError(error)) return statusMessage(error.response?.status)

  const native = nativeError(error)
  if (native) {
    const translated = translatedServerMessage(
      native.message ?? '',
      native.code
    )
    if (translated) return translated
    if (native.message) return native.message
    return statusMessage(native.status)
  }

  // Guard errors thrown by the client carry an already localized message.
  // Wrapped native failures may still carry the known English text.
  if (error instanceof Error && error.message.trim())
    return translatedMessage(error.message) || error.message

  return t('common:errors.operationFailed')
}
