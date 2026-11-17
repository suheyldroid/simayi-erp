import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useOptionalBranch } from '@/lib/branch-boundary'
import { t } from '@/lib/i18n'
import {
  organizationLocation,
  organizationSectionTarget,
  useOrganizationScope,
} from '@/lib/organization-navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { branchesListQueryOptions } from './api'

const COMPANY_VALUE = '__company__'

/**
 * Branch selection. It navigates between the two path scopes:
 * `/o/<slug>` is the company scope (all organization records) and
 * `/o/<slug>/b/<uuid>` is one verified branch. The company option is not an
 * organization selector: it returns to the company path of the same
 * organization.
 *
 * The destination keeps the current section (`organizationSectionTarget`), so a
 * branch switch never carries a record UUID of the previous branch: a detail
 * page moves to its list. Selection never touches the native session,
 * `activeTeamId` or the active organization.
 *
 * Mounted in the workspace sidebar header and in organization settings
 * navigation; only rendered inside the verified organization boundary.
 */
export function BranchSwitcher({ id = 'active-branch' }: { id?: string }) {
  const navigate = useNavigate()
  const pathname = useLocation({ select: (location) => location.pathname })
  const { organizationSlug, branchUuid } = useOrganizationScope()
  const branch = useOptionalBranch()
  const branches = useQuery(branchesListQueryOptions({ limit: 100 }))
  const items = branches.data?.items ?? []
  // The directory may be paged; keep the verified current branch selectable
  // even when it falls outside the first page.
  const options =
    branch && !items.some((item) => item.uuid === branch.branchUuid)
      ? [branch.branch, ...items]
      : items

  function select(value: string) {
    const nextBranchUuid = value === COMPANY_VALUE ? null : value
    const target = organizationSectionTarget(pathname, organizationSlug)
    void navigate(
      organizationLocation(organizationSlug, nextBranchUuid, target)
    )
  }

  return (
    <div className='space-y-1 px-2'>
      <Label htmlFor={id} className='text-xs text-muted-foreground'>
        {t('catalog:branches.switcher.label')}
      </Label>
      {branches.isPending ? (
        <p role='status'>{t('catalog:branches.switcher.loading')}</p>
      ) : null}
      {branches.isError ? (
        <p role='alert' className='text-sm'>
          {t('catalog:branches.switcher.error')}{' '}
          <Button
            type='button'
            variant='link'
            onClick={() => void branches.refetch()}
          >
            {t('catalog:common.retry')}
          </Button>
        </p>
      ) : null}
      {branches.isSuccess ? (
        <Select value={branchUuid ?? COMPANY_VALUE} onValueChange={select}>
          <SelectTrigger id={id} className='w-full'>
            <SelectValue placeholder={t('catalog:branches.switcher.company')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={COMPANY_VALUE}>
              {t('catalog:branches.switcher.company')}
            </SelectItem>
            {options.map((option) => (
              <SelectItem key={option.uuid} value={option.uuid}>
                {option.name}
                {option.active
                  ? ''
                  : t('catalog:branches.switcher.inactiveSuffix')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  )
}
