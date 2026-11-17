import { errorMessage } from '@/lib/api-error'
import { api, branchApi } from '@/lib/auth'
import {
  PosDevicesPageModel,
  type PosDeviceInput,
  type PosDeviceUpdate,
  type ZReportInput,
  type ZReportUpdate,
} from './model'

export { errorMessage }

const PAGE_SIZE = 20

/**
 * POS devices and their Z reports are branch-owned. Writes always carry the
 * explicit active branch and the backend never falls back to a default branch.
 * Index reads can run in Company context (`branchUuid: null`), where the
 * backend aggregates every same-organization branch and each row carries its
 * owning branch provenance; detail reads stay inside the owning branch path.
 */
export const posDevicesApi = {
  async list(input: {
    branchUuid: string | null
    page: number
    search: string
  }) {
    const params = {
      limit: PAGE_SIZE,
      offset: input.page * PAGE_SIZE,
      search: input.search || undefined,
    }
    return PosDevicesPageModel.deviceList.parse(
      (
        await (input.branchUuid === null
          ? api.get<unknown>('/pos-devices/', { params })
          : branchApi.get<unknown>('/pos-devices/', {
              branchUuid: input.branchUuid,
              params,
            }))
      ).data
    )
  },
  async get(branchUuid: string | null, uuid: string) {
    return PosDevicesPageModel.device.parse(
      (
        await (branchUuid === null
          ? api.get<unknown>(`/pos-devices/${uuid}`)
          : branchApi.get<unknown>(`/pos-devices/${uuid}`, { branchUuid }))
      ).data
    )
  },
  async create(branchUuid: string, body: PosDeviceInput) {
    return PosDevicesPageModel.device.parse(
      (await branchApi.post<unknown>('/pos-devices/', body, { branchUuid }))
        .data
    )
  },
  async update(branchUuid: string, uuid: string, body: PosDeviceUpdate) {
    return PosDevicesPageModel.device.parse(
      (
        await branchApi.patch<unknown>(`/pos-devices/${uuid}`, body, {
          branchUuid,
        })
      ).data
    )
  },
}

export const zReportsApi = {
  /**
   * A device page filters by `posDeviceUuid`; a sales batch page filters by
   * `salesBatchUuid`. Both run in the owning branch. In Company context
   * (`branchUuid: null`) the backend aggregates every same-organization branch
   * and each report carries its owning branch provenance. All three use the
   * real limit/offset/total envelope.
   */
  async list(input: {
    branchUuid: string | null
    page: number
    search?: string
    posDeviceUuid?: string
    salesBatchUuid?: string
    limit?: number
  }) {
    const limit = input.limit ?? PAGE_SIZE
    const params = {
      limit,
      offset: input.page * limit,
      search: input.search || undefined,
      posDeviceUuid: input.posDeviceUuid,
      salesBatchUuid: input.salesBatchUuid,
    }
    return PosDevicesPageModel.reportList.parse(
      (
        await (input.branchUuid === null
          ? api.get<unknown>('/pos-devices/z-reports/', { params })
          : branchApi.get<unknown>('/pos-devices/z-reports/', {
              branchUuid: input.branchUuid,
              params,
            }))
      ).data
    )
  },
  async get(branchUuid: string | null, deviceUuid: string, uuid: string) {
    return PosDevicesPageModel.report.parse(
      (
        await (branchUuid === null
          ? api.get<unknown>(`/pos-devices/${deviceUuid}/z-reports/${uuid}`)
          : branchApi.get<unknown>(
              `/pos-devices/${deviceUuid}/z-reports/${uuid}`,
              { branchUuid }
            ))
      ).data
    )
  },
  async create(branchUuid: string, deviceUuid: string, body: ZReportInput) {
    return PosDevicesPageModel.report.parse(
      (
        await branchApi.post<unknown>(
          `/pos-devices/${deviceUuid}/z-reports/`,
          body,
          { branchUuid }
        )
      ).data
    )
  },
  async update(
    branchUuid: string,
    deviceUuid: string,
    uuid: string,
    body: ZReportUpdate
  ) {
    return PosDevicesPageModel.report.parse(
      (
        await branchApi.patch<unknown>(
          `/pos-devices/${deviceUuid}/z-reports/${uuid}`,
          body,
          { branchUuid }
        )
      ).data
    )
  },
}
