import type { QueryClient } from '@tanstack/react-query'
import type { CapturedBranchScope } from '@/lib/branch-scope'

type Client = Pick<QueryClient, 'invalidateQueries'>

/** Recipe and sales keys whose scope belongs to this company. */
function scopeBelongsToCompany(queryKey: readonly unknown[], prefix: string) {
  const scope = queryKey[1]
  return typeof scope === 'string' && scope.startsWith(prefix)
}

/**
 * Invalidate the caches a branch recipe mutation changes: the branch catalog
 * and detail, sale pickers, batch previews, the company aggregate index (which
 * lists every branch's local recipes) and the company finance projection
 * (pricing a recipe captures the company currency).
 */
async function invalidateRecipeData(
  client: Client,
  organizationScope: string,
  scopeKey: string
) {
  // Company aggregate key of the same organization; built from the captured
  // organization scope, never from the ambient organization at settlement.
  const companyScope = `${organizationScope}::company`
  await Promise.all([
    client.invalidateQueries({ queryKey: ['recipe', scopeKey] }),
    client.invalidateQueries({ queryKey: ['recipe', companyScope] }),
    client.invalidateQueries({ queryKey: ['sales', scopeKey] }),
    client.invalidateQueries({ queryKey: ['sales', companyScope] }),
    client.invalidateQueries({ queryKey: ['finance', organizationScope] }),
  ])
}

/**
 * A company template edit feeds every branch catalog, picker and batch preview
 * in the same company, so invalidate every scope of this company — never
 * another company's caches. Shared sales channels are company metadata and are
 * not affected.
 */
async function invalidateCompanyRecipeData(
  client: Client,
  organizationScope: string
) {
  const prefix = `${organizationScope}::`
  await Promise.all([
    client.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === 'recipe' &&
        scopeBelongsToCompany(query.queryKey, prefix),
    }),
    client.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === 'sales' &&
        query.queryKey[2] !== 'channels' &&
        scopeBelongsToCompany(query.queryKey, prefix),
    }),
    client.invalidateQueries({ queryKey: ['finance', organizationScope] }),
  ])
}

/** Invalidate exactly the captured scope, whichever context ran the mutation. */
export async function invalidateCapturedRecipeData(
  client: Client,
  captured: CapturedBranchScope
) {
  if (captured.branchUuid === null)
    await invalidateCompanyRecipeData(client, captured.organizationScope)
  else
    await invalidateRecipeData(
      client,
      captured.organizationScope,
      captured.scope
    )
}
