import { ZodError } from 'zod'
import axios from 'axios'

export function errorMessage(error: unknown) {
  if (error instanceof ZodError)
    return error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(' · ')
  if (axios.isAxiosError(error)) {
    const message: unknown = error.response?.data?.error?.message
    if (typeof message === 'string') return message
  }
  return 'Operation failed. Check the connection and try again.'
}
