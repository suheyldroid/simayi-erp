import { api } from '@/lib/auth'
import { CommonModel } from '../common/model'
import {
  CurrencyModel,
  type BackendName,
  type Snapshot,
  type ConversionInput,
} from './model'

export const currencyApi = {
  async currencies() {
    return CurrencyModel.currencies.parse(
      (await api.get<unknown>('/currency/currencies')).data
    )
  },
  async backends() {
    return CurrencyModel.backends.parse(
      (await api.get<unknown>('/currency/backends')).data
    )
  },
  async create(name: BackendName, baseCurrency: string) {
    return CurrencyModel.backend.parse(
      (await api.post<unknown>('/currency/backends', { name, baseCurrency }))
        .data
    )
  },
  async update(name: BackendName, baseCurrency: string) {
    return CurrencyModel.backend.parse(
      (await api.patch<unknown>(`/currency/backends/${name}`, { baseCurrency }))
        .data
    )
  },
  async remove(name: BackendName) {
    return CommonModel.success.parse(
      (await api.delete<unknown>(`/currency/backends/${name}`)).data
    )
  },
  async refresh(name: BackendName) {
    return CurrencyModel.backend.parse(
      (await api.post<unknown>(`/currency/backends/${name}/refresh`)).data
    )
  },
  async rates(name: BackendName) {
    return CurrencyModel.rates.parse(
      (await api.get<unknown>(`/currency/backends/${name}/rates/`)).data
    )
  },
  async saveRates(name: BackendName, body: Snapshot) {
    return CurrencyModel.rates.parse(
      (await api.put<unknown>(`/currency/backends/${name}/rates/`, body)).data
    )
  },
  async removeRate(name: BackendName, currency: string) {
    return CommonModel.success.parse(
      (
        await api.delete<unknown>(
          `/currency/backends/${name}/rates/${encodeURIComponent(currency)}`
        )
      ).data
    )
  },
  async convert(body: ConversionInput) {
    return CurrencyModel.conversion.parse(
      (await api.post<unknown>('/currency/convert', body)).data
    )
  },
}
