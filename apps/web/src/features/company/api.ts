import { api } from '@/lib/auth'
import { errorMessage } from '@/features/common/api'
import {
  CompanyModel,
  type AddressInput,
  type CompanyFilter,
  type CompanyInput,
  type ContactInput,
} from './model'

export { errorMessage }

const params = (
  page: number,
  search: string,
  filter: CompanyFilter = 'all',
  active?: boolean
) => ({
  limit: 20,
  offset: page * 20,
  search,
  ...(filter === 'customers' ? { isCustomer: true } : {}),
  ...(filter === 'suppliers' ? { isSupplier: true } : {}),
  ...(filter === 'manufacturers' ? { isManufacturer: true } : {}),
  ...(active === undefined ? {} : { active }),
})

export const companyApi = {
  async list(
    page = 0,
    search = '',
    filter: CompanyFilter = 'all',
    active?: boolean
  ) {
    return CompanyModel.companies.parse(
      (
        await api.get<unknown>('/company/', {
          params: params(page, search, filter, active),
        })
      ).data
    )
  },
  async save(body: CompanyInput, id?: number) {
    return CompanyModel.company.parse(
      (id === undefined
        ? await api.post<unknown>('/company/', body)
        : await api.patch<unknown>(`/company/${id}`, body)
      ).data
    )
  },
  async remove(id: number) {
    return CompanyModel.success.parse(
      (await api.delete<unknown>(`/company/${id}`)).data
    )
  },
  async contacts(companyId: number, page = 0, search = '') {
    return CompanyModel.contacts.parse(
      (
        await api.get<unknown>(`/company/${companyId}/contacts/`, {
          params: params(page, search),
        })
      ).data
    )
  },
  async saveContact(companyId: number, body: ContactInput, id?: number) {
    return CompanyModel.contact.parse(
      (id === undefined
        ? await api.post<unknown>(`/company/${companyId}/contacts/`, body)
        : await api.patch<unknown>(`/company/${companyId}/contacts/${id}`, body)
      ).data
    )
  },
  async removeContact(companyId: number, id: number) {
    return CompanyModel.success.parse(
      (await api.delete<unknown>(`/company/${companyId}/contacts/${id}`)).data
    )
  },
  async addresses(companyId: number, page = 0, search = '') {
    return CompanyModel.addresses.parse(
      (
        await api.get<unknown>(`/company/${companyId}/addresses/`, {
          params: params(page, search),
        })
      ).data
    )
  },
  async saveAddress(companyId: number, body: AddressInput, id?: number) {
    return CompanyModel.address.parse(
      (id === undefined
        ? await api.post<unknown>(`/company/${companyId}/addresses/`, body)
        : await api.patch<unknown>(
            `/company/${companyId}/addresses/${id}`,
            body
          )
      ).data
    )
  },
  async removeAddress(companyId: number, id: number) {
    return CompanyModel.success.parse(
      (await api.delete<unknown>(`/company/${companyId}/addresses/${id}`)).data
    )
  },
}
