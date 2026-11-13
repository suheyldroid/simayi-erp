import type { QueryClient } from '@tanstack/react-query'

/**
 * Invalidate the global unit catalog and every cached server payload that
 * embeds a unit label (item records, stock views, recipe views and dashboard
 * cards). The catalog is global, so a rename or deactivation in one
 * organization also affects the caches of every other organization; the
 * tenant-scoped keys are therefore invalidated by their resource root rather
 * than by one captured organization scope.
 */
export async function invalidateUnitCatalog(
  client: Pick<QueryClient, 'invalidateQueries'>
) {
  const roots = ['unit', 'item', 'stock', 'recipe', 'dashboard'] as const
  await Promise.all(
    roots.map((root) => client.invalidateQueries({ queryKey: [root] }))
  )
}
