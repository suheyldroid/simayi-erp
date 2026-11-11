import { z } from 'zod'
import { api } from '@/lib/auth'

export const supplierImagePrefix = '/supplier/images/'

const imageReference = z.object({
  image: z
    .string()
    .max(100)
    .regex(/^\/supplier\/images\/[0-9a-f-]{36}\.(?:png|jpg|webp)$/),
})

export const supplierImageApi = {
  async upload(file: File) {
    const body = new FormData()
    body.append('image', file)
    return imageReference.parse(
      (await api.post<unknown>('/supplier/images/', body)).data
    )
  },
}
