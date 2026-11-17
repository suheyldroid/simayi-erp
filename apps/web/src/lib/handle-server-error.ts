import { toast } from 'sonner'
import { errorMessage } from '@/lib/api-error'
import { t } from '@/lib/i18n'

export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(error)
  }

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    toast.error(t('common:errors.noContent'))
    return
  }

  toast.error(errorMessage(error))
}
