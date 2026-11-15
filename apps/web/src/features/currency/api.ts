import { errorMessage } from '@/lib/api-error'
import { globalApi } from '@/lib/auth'
import { CurrencyModel } from './model'

export { errorMessage }

/**
 * Global currency reads. Both the server-owned ISO catalog and the single
 * system-wide default are account-level resources: they work without an active
 * organization and never attach a tenant header.
 */
export const currencyApi = {
  async currencies() {
    return CurrencyModel.catalog.parse(
      (await globalApi.get<unknown>('/currencies')).data
    )
  },
  async preference() {
    return CurrencyModel.preference.parse(
      (await globalApi.get<unknown>('/system-preferences')).data
    )
  },
  async savePreference(defaultCurrencyCode: string) {
    return CurrencyModel.preference.parse(
      (
        await globalApi.patch<unknown>(
          '/system-preferences',
          CurrencyModel.preferenceInput.parse({ defaultCurrencyCode })
        )
      ).data
    )
  },
}
