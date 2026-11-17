import axios from 'axios'
import { errorMessage } from '@/lib/api-error'
import { api, branchApi } from '@/lib/auth'
import {
  SalesBatchesPageModel,
  type BatchDetail,
  type BatchPatch,
  type BatchPreview,
} from './model'

export { errorMessage }

export type BatchRowProblem = {
  row: number
  channel: string
  product: string
  quantity: string
  issues: { code: string; message: string; blocking: boolean }[]
}

function rowProblems(value: unknown): BatchRowProblem[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is BatchRowProblem => {
    if (entry == null || typeof entry !== 'object') return false
    if (!('row' in entry) || typeof entry.row !== 'number') return false
    if (!('issues' in entry) || !Array.isArray(entry.issues)) return false
    return entry.issues.every(
      (issue: unknown) =>
        issue != null &&
        typeof issue === 'object' &&
        'code' in issue &&
        typeof issue.code === 'string' &&
        'message' in issue &&
        typeof issue.message === 'string' &&
        'blocking' in issue &&
        typeof issue.blocking === 'boolean'
    )
  })
}

export function batchRowProblems(error: unknown): BatchRowProblem[] {
  if (!axios.isAxiosError(error)) return []
  const details: unknown = error.response?.data?.error?.details
  if (details == null || typeof details !== 'object') return []
  if (!('issues' in details)) return []
  return rowProblems(details.issues)
}

function downloadName(header: string | undefined, fallback: string) {
  if (!header) return fallback
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded)
    } catch {
      return fallback
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header)?.[1]
  return plain ?? fallback
}

/**
 * A sales batch is fixed to one branch from upload onward. Lists can run in
 * Company context, where the backend aggregates every branch of the verified
 * organization; every other call carries the explicit owning branch so
 * previews, mappings and stock never mix branches.
 */
export const salesBatchesApi = {
  async list(input: {
    branchUuid: string | null
    page: number
    search: string
  }) {
    const params = {
      limit: 20,
      offset: input.page * 20,
      search: input.search || undefined,
    }
    return SalesBatchesPageModel.list.parse(
      (
        await (input.branchUuid === null
          ? api.get<unknown>('/sales/batches/', { params })
          : branchApi.get<unknown>('/sales/batches/', {
              branchUuid: input.branchUuid,
              params,
            }))
      ).data
    )
  },
  async get(branchUuid: string | null, uuid: string): Promise<BatchDetail> {
    return SalesBatchesPageModel.detail.parse(
      (
        await (branchUuid === null
          ? api.get<unknown>(`/sales/batches/${uuid}`)
          : branchApi.get<unknown>(`/sales/batches/${uuid}`, { branchUuid }))
      ).data
    )
  },
  async preview(
    branchUuid: string,
    uuid: string,
    sheet?: string
  ): Promise<BatchPreview> {
    return SalesBatchesPageModel.preview.parse(
      (
        await branchApi.get<unknown>(`/sales/batches/${uuid}/preview`, {
          branchUuid,
          params: sheet === undefined ? undefined : { sheet },
        })
      ).data
    )
  },
  async upload(branchUuid: string, file: File): Promise<BatchDetail> {
    const body = new FormData()
    body.append('file', file)
    return SalesBatchesPageModel.detail.parse(
      (await branchApi.post<unknown>('/sales/batches/', body, { branchUuid }))
        .data
    )
  },
  async update(
    branchUuid: string,
    uuid: string,
    body: BatchPatch
  ): Promise<BatchDetail> {
    return SalesBatchesPageModel.detail.parse(
      (
        await branchApi.patch<unknown>(`/sales/batches/${uuid}`, body, {
          branchUuid,
        })
      ).data
    )
  },
  async process(branchUuid: string, uuid: string): Promise<BatchDetail> {
    return SalesBatchesPageModel.detail.parse(
      (
        await branchApi.post<unknown>(`/sales/batches/${uuid}/process`, null, {
          branchUuid,
        })
      ).data
    )
  },
  async destroy(branchUuid: string, uuid: string) {
    return (
      await branchApi.delete<unknown>(`/sales/batches/${uuid}`, { branchUuid })
    ).data as { success: true }
  },
  /**
   * Workbook download is a read. Company context reads the batch's stored file
   * through the company client (no branch header), like the batch list/detail;
   * a branch path downloads through its own captured branch.
   */
  async download(
    branchUuid: string | null,
    uuid: string
  ): Promise<{ blob: Blob; fileName: string }> {
    const response = await (branchUuid === null
      ? api.get<Blob>(`/sales/batches/${uuid}/file`, { responseType: 'blob' })
      : branchApi.get<Blob>(`/sales/batches/${uuid}/file`, {
          branchUuid,
          responseType: 'blob',
        }))
    return {
      blob: response.data,
      fileName: downloadName(
        response.headers['content-disposition'] as string | undefined,
        'workbook.xlsx'
      ),
    }
  },
}
