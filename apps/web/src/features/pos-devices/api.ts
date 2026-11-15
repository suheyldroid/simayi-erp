import { errorMessage } from '@/lib/api-error'
import { api } from '@/lib/auth'
import {
  PosDevicesPageModel,
  type PosDeviceInput,
  type PosDeviceUpdate,
  type ZReportInput,
  type ZReportUpdate,
} from './model'

export { errorMessage }

const PAGE_SIZE = 20

export const posDevicesApi = {
  async list(input: { page: number; search: string }) {
    return PosDevicesPageModel.deviceList.parse(
      (
        await api.get<unknown>('/pos-devices/', {
          params: {
            limit: PAGE_SIZE,
            offset: input.page * PAGE_SIZE,
            search: input.search || undefined,
          },
        })
      ).data
    )
  },
  async get(uuid: string) {
    return PosDevicesPageModel.device.parse(
      (await api.get<unknown>(`/pos-devices/${uuid}`)).data
    )
  },
  async create(body: PosDeviceInput) {
    return PosDevicesPageModel.device.parse(
      (await api.post<unknown>('/pos-devices/', body)).data
    )
  },
  async update(uuid: string, body: PosDeviceUpdate) {
    return PosDevicesPageModel.device.parse(
      (await api.patch<unknown>(`/pos-devices/${uuid}`, body)).data
    )
  },
}

export const zReportsApi = {
  /**
   * The report list is a flat organization endpoint. A device page filters by
   * `posDeviceUuid`; a sales batch page filters by `salesBatchUuid`. Both use
   * the same real limit/offset/total envelope.
   */
  async list(input: {
    page: number
    search?: string
    posDeviceUuid?: string
    salesBatchUuid?: string
    limit?: number
  }) {
    const limit = input.limit ?? PAGE_SIZE
    return PosDevicesPageModel.reportList.parse(
      (
        await api.get<unknown>('/pos-devices/z-reports/', {
          params: {
            limit,
            offset: input.page * limit,
            search: input.search || undefined,
            posDeviceUuid: input.posDeviceUuid,
            salesBatchUuid: input.salesBatchUuid,
          },
        })
      ).data
    )
  },
  async get(deviceUuid: string, uuid: string) {
    return PosDevicesPageModel.report.parse(
      (await api.get<unknown>(`/pos-devices/${deviceUuid}/z-reports/${uuid}`))
        .data
    )
  },
  async create(deviceUuid: string, body: ZReportInput) {
    return PosDevicesPageModel.report.parse(
      (await api.post<unknown>(`/pos-devices/${deviceUuid}/z-reports/`, body))
        .data
    )
  },
  async update(deviceUuid: string, uuid: string, body: ZReportUpdate) {
    return PosDevicesPageModel.report.parse(
      (
        await api.patch<unknown>(
          `/pos-devices/${deviceUuid}/z-reports/${uuid}`,
          body
        )
      ).data
    )
  },
}
