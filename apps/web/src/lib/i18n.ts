import { z } from 'zod'
import { tr as dateLocale } from 'date-fns/locale'
import i18next, { type ResourceKey, type TFunction } from 'i18next'
import { initReactI18next } from 'react-i18next'
import catalog from '@/locales/tr/catalog.json'
import common from '@/locales/tr/common.json'
import dashboard from '@/locales/tr/dashboard.json'
import global from '@/locales/tr/global.json'
import operations from '@/locales/tr/operations.json'

export const locale = 'tr-TR'

/** date-fns locale for calendar and date formatting. */
export { dateLocale }

/**
 * Backend error texts are translated in their own namespace because they are
 * keyed by the stable English message the API returns, not by a semantic path.
 */
const serverMessages = common.serverMessages

const resources: Record<string, ResourceKey> = {
  common,
  global,
  dashboard,
  catalog,
  operations,
  serverMessages,
}

void i18next.use(initReactI18next).init({
  resources: { tr: resources },
  lng: 'tr',
  fallbackLng: 'tr',
  supportedLngs: ['tr'],
  defaultNS: 'common',
  ns: Object.keys(resources),
  interpolation: { escapeValue: false },
  initAsync: false,
  returnNull: false,
})

// Zod validation messages default to Turkish. Schemas that pass their own
// message keep it; this only fills the built-in ones.
z.config(z.locales.tr())

/** Synchronous translator bound to the local instance. */
export const t = i18next.t.bind(i18next) as TFunction

export default i18next
