import { z } from 'zod'
import { globalApi } from '@/lib/auth'

/**
 * Public prefix of an uploaded organization logo. The reference is global
 * (account-scoped upload), so it is uploaded with `globalApi`, never the
 * tenant client.
 */
export const organizationLogoPrefix = '/media/'

const uploadedLogo = z.object({
  reference: z
    .string()
    .regex(/^\/media\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/),
})

export const organizationLogoApi = {
  async upload(file: File) {
    const body = new FormData()
    body.append('image', file)
    return uploadedLogo.parse(
      (await globalApi.post<unknown>('/media/temporary-logo', body)).data
    )
  },
}
