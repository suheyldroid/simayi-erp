import { z } from 'zod'
import { globalApi } from '@/lib/auth'

/**
 * Canonical native account avatar reference. Uploads are account-scoped and
 * global (no tenant header); the returned reference is the only value written
 * to `User.image`.
 */
export const avatarReferencePrefix = '/media/avatars/'

const uploadedAvatar = z.object({
  reference: z
    .string()
    .regex(/^\/media\/avatars\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/),
})

export const profileAvatarApi = {
  async upload(file: File) {
    const body = new FormData()
    body.append('image', file)
    return uploadedAvatar.parse(
      (await globalApi.post<unknown>('/media/temporary-avatar', body)).data
    )
  },
  /**
   * Platform-admin target upload. The server derives authority from the native
   * account role, validates the target account, and stores the temporary row
   * owned by that target so the native update can claim it.
   */
  async uploadForTarget(userId: string, file: File) {
    const body = new FormData()
    body.append('image', file)
    return uploadedAvatar.parse(
      (
        await globalApi.post<unknown>(
          `/media/temporary-avatar/${encodeURIComponent(userId)}`,
          body
        )
      ).data
    )
  },
}
