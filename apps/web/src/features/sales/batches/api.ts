import axios from 'axios'
import { errorMessage } from '@/lib/api-error'
import { api } from '@/lib/auth'
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

export const salesBatchesApi = {
  async list(input: { page: number; search: string }) {
    return SalesBatchesPageModel.list.parse(
      (
        await api.get<unknown>('/sales/batches/', {
          params: {
            limit: 20,
            offset: input.page * 20,
            search: input.search || undefined,
          },
        })
      ).data
    )
  },
  async get(uuid: string): Promise<BatchDetail> {
    return SalesBatchesPageModel.detail.parse(
      (await api.get<unknown>(`/sales/batches/${uuid}`)).data
    )
  },
  async preview(uuid: string, sheet?: string): Promise<BatchPreview> {
    return SalesBatchesPageModel.preview.parse(
      (
        await api.get<unknown>(`/sales/batches/${uuid}/preview`, {
          params: sheet === undefined ? undefined : { sheet },
        })
      ).data
    )
  },
  async upload(file: File): Promise<BatchDetail> {
    const body = new FormData()
    body.append('file', file)
    return SalesBatchesPageModel.detail.parse(
      (await api.post<unknown>('/sales/batches/', body)).data
    )
  },
  async update(uuid: string, body: BatchPatch): Promise<BatchDetail> {
    return SalesBatchesPageModel.detail.parse(
      (await api.patch<unknown>(`/sales/batches/${uuid}`, body)).data
    )
  },
  async process(uuid: string): Promise<BatchDetail> {
    return SalesBatchesPageModel.detail.parse(
      (await api.post<unknown>(`/sales/batches/${uuid}/process`)).data
    )
  },
  async destroy(uuid: string) {
    return (await api.delete<unknown>(`/sales/batches/${uuid}`)).data as {
      success: true
    }
  },
  async download(uuid: string): Promise<{ blob: Blob; fileName: string }> {
    const response = await api.get<Blob>(`/sales/batches/${uuid}/file`, {
      responseType: 'blob',
    })
    return {
      blob: response.data,
      fileName: downloadName(
        response.headers['content-disposition'] as string | undefined,
        'workbook.xlsx'
      ),
    }
  },
}
