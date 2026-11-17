import axios from 'axios'
import { createFileRoute, notFound, Outlet } from '@tanstack/react-router'
import { setActiveBranch } from '@/lib/branch-scope'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { assertSameOrganization } from '@/lib/tenant'
import { branchDetailQueryOptions } from '@/features/branches/api'

/** Unknown or cross-company branch UUIDs are the same missing resource. */
function isMissingBranch(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 404
}

/**
 * Branch scope boundary. The parent organization route proved native
 * membership, the live session and the active member; this route must prove
 * that the UUID names a branch of that same company before any child mounts.
 * A malformed UUID never reaches the API, and the tenant-scoped read fails
 * closed for unknown or foreign branches. There is no fallback branch.
 */
export const Route = createFileRoute(
  '/_authenticated/o/$organizationSlug/b/$branchUuid'
)({
  preload: false,
  beforeLoad: async ({ context, params, abortController, preload }) => {
    // Hover/intent preloads must never verify a tenant branch, mutate the
    // active branch or abort in-flight branch requests: they run while the
    // user is still on the current page. `preload: false` above documents the
    // intent, but the option does not suppress this hook, so the guard is
    // explicit. Preloaded matches are not rendered; the real navigation runs
    // this hook again with `preload === false` and verifies before mount.
    if (preload) return { branch: null }

    const branchUuid = parseResourceUuid(params.branchUuid)
    if (!branchUuid) throw notFound()

    const branch = await context.queryClient
      .fetchQuery(branchDetailQueryOptions(branchUuid))
      .catch((error: unknown) => {
        if (isMissingBranch(error)) throw notFound()
        throw error
      })

    // The read is tenant-scoped, but prove the pin still names the URL
    // organization so a stale pin can never authorize another company's
    // branch.
    assertSameOrganization(context.organization.id)

    // Publish the verified selection to the transport/cache layer before the
    // operational subtree renders; a change aborts stale branch requests and
    // cancels the previous branch's queries. A superseded navigation (the
    // router aborts this match's controller when a newer one starts) must
    // never publish its stale branch over the newer selection.
    if (!abortController.signal.aborted) setActiveBranch(branch.uuid)

    return { branch }
  },
  component: Outlet,
})
