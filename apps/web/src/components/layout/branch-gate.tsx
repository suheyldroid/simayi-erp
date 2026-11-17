import type { ReactNode } from 'react'
import { useOptionalBranch } from '@/lib/branch-boundary'
import { t } from '@/lib/i18n'

/**
 * Renders its children only when a verified branch is selected. In Company
 * context it renders the branch-required notice instead, so branch-only pages
 * never mount branch data or branch-required hooks without a branch.
 */
export function BranchRequired({
  children,
  description,
}: {
  children?: ReactNode
  description?: string
}) {
  const branch = useOptionalBranch()
  if (branch) return <>{children}</>
  return (
    <section className='space-y-2 rounded-md border border-border p-4'>
      <h3 className='font-medium'>{t('common:states.selectBranch')}</h3>
      <p className='text-sm text-muted-foreground'>
        {description ?? t('common:states.selectBranchDescription')}
      </p>
    </section>
  )
}

/**
 * Marks an inactive selected branch: history stays readable, writes are
 * blocked. Renders nothing for active branches or Company context.
 */
export function BranchInactiveNotice({ branchName }: { branchName?: string }) {
  const branch = useOptionalBranch()
  if (!branch || branch.branch.active) return null
  return (
    <p role='status' className='rounded-md border border-border p-3 text-sm'>
      {t('common:states.branchInactive', {
        name: branchName ?? branch.branch.name,
      })}
    </p>
  )
}
