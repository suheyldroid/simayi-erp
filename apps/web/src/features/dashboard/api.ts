import { errorMessage } from '@/lib/api-error'
import { globalApi } from '@/lib/auth'
import { personalDashboardSchema, systemDashboardSchema } from './model'

export { errorMessage }

/**
 * Global dashboard aggregates. Both calls use the account client: they are
 * never tenant-scoped and never depend on the active organization pin/freeze.
 */
export const dashboardApi = {
  async system() {
    const { data } = await globalApi.get<unknown>('/dashboard/system')
    return systemDashboardSchema.parse(data)
  },
  async personal() {
    const { data } = await globalApi.get<unknown>('/dashboard/personal')
    return personalDashboardSchema.parse(data)
  },
}
