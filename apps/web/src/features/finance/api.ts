import { errorMessage } from '@/lib/api-error'
import { api } from '@/lib/auth'
import { FinancePageModel, type MoneyInput } from './model'

export { errorMessage }

export const financeApi = {
  async summary() {
    return FinancePageModel.summary.parse(
      (await api.get<unknown>('/finance/')).data
    )
  },
  async movements(input: { page: number; search: string }) {
    return FinancePageModel.list.parse(
      (
        await api.get<unknown>('/finance/movements/', {
          params: {
            limit: 20,
            offset: input.page * 20,
            search: input.search || undefined,
          },
        })
      ).data
    )
  },
  async movement(uuid: string) {
    return FinancePageModel.movement.parse(
      (await api.get<unknown>(`/finance/movements/${uuid}`)).data
    )
  },
  async income(body: MoneyInput) {
    return FinancePageModel.movement.parse(
      (await api.post<unknown>('/finance/income/', body)).data
    )
  },
  async expense(body: MoneyInput) {
    return FinancePageModel.movement.parse(
      (await api.post<unknown>('/finance/expense/', body)).data
    )
  },
  async reverse(uuid: string) {
    return FinancePageModel.movement.parse(
      (await api.post<unknown>(`/finance/movements/${uuid}/reverse`)).data
    )
  },
}

export const supplierLedgerApi = {
  async ledger(supplierUuid: string, input: { page: number }) {
    return FinancePageModel.ledger.parse(
      (
        await api.get<unknown>(`/supplier/${supplierUuid}/ledger/`, {
          params: { limit: 10, offset: input.page * 10 },
        })
      ).data
    )
  },
  async payment(supplierUuid: string, body: MoneyInput) {
    return FinancePageModel.supplierEntry.parse(
      (await api.post<unknown>(`/supplier/${supplierUuid}/payments/`, body))
        .data
    )
  },
}
