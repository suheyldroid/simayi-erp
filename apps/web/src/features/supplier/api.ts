import { errorMessage } from '@/lib/api-error'
import { api } from '@/lib/auth'
import { SupplierModel, type SupplierInput } from './model'

export { errorMessage }

const params = (page: number, search: string, active?: boolean) => ({
  limit: 20,
  offset: page * 20,
  search,
  ...(active === undefined ? {} : { active }),
})

export const supplierApi = {
  async list(page = 0, search = '', active?: boolean) {
    return SupplierModel.suppliers.parse(
      (
        await api.get<unknown>('/supplier/', {
          params: params(page, search, active),
        })
      ).data
    )
  },
  async get(uuid: string) {
    return SupplierModel.supplier.parse(
      (await api.get<unknown>(`/supplier/${uuid}`)).data
    )
  },
  async save(body: SupplierInput, uuid?: string) {
    return SupplierModel.supplier.parse(
      (uuid === undefined
        ? await api.post<unknown>('/supplier/', body)
        : await api.patch<unknown>(`/supplier/${uuid}`, body)
      ).data
    )
  },
  async remove(uuid: string) {
    return SupplierModel.success.parse(
      (await api.delete<unknown>(`/supplier/${uuid}`)).data
    )
  },
}
