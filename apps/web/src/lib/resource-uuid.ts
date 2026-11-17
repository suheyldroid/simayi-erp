import { z } from 'zod'
import { t } from '@/lib/i18n'

/**
 * Application-owned resource identity. Every public record key is a UUID
 * string; numeric internal ids never cross this boundary.
 */
export const resourceUuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Canonical UUID schema: trims, accepts any case, exposes lowercase. */
export const resourceUuid = z
  .string()
  .trim()
  .regex(resourceUuidRegex, t('common:validation.uuid'))
  .transform((value) => value.toLowerCase())

/**
 * Route-parameter parser. Returns the canonical lowercase UUID, or null when
 * the value is not a UUID so invalid routes fail closed.
 */
export function parseResourceUuid(value: string): string | null {
  const trimmed = value.trim()
  return resourceUuidRegex.test(trimmed) ? trimmed.toLowerCase() : null
}
