import { z } from 'zod'
import { api } from '@/lib/auth'

export const itemImagePrefix = '/items/images/'

const imageReference = z.object({
  image: z
    .string()
    .max(100)
    .regex(/^\/items\/images\/[0-9a-f-]{36}\.(?:png|jpg|webp)$/),
})

export const itemImageApi = {
  async upload(file: File) {
    const body = new FormData()
    body.append('image', file)
    return imageReference.parse(
      (await api.post<unknown>('/items/images/', body)).data
    )
  },
}
