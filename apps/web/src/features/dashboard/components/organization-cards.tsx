import { Link } from '@tanstack/react-router'
import { imageUrl } from '@/lib/image-url'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useOrganizationMemberships } from '@/features/organization/membership-query'
import type { OrganizationRecord } from '@/features/organization/model'
import { CreateOrganizationSheet } from '@/features/organization/organization-forms'
import { errorMessage } from '../api'

function organizationInitials(organization: OrganizationRecord) {
  const words = (organization.name.trim() || organization.slug.trim())
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  if (words.length === 0) return '?'
  return words.map((word) => word[0]?.toUpperCase() ?? '').join('')
}

/**
 * Pure navigation card. The card itself only navigates to the organization
 * boundary where activation is handled; no tenant mutation runs here.
 */
function OrganizationCard({
  organization,
}: {
  organization: OrganizationRecord
}) {
  const name = organization.name || organization.slug
  return (
    <li>
      <Link
        to='/o/$organizationSlug'
        params={{ organizationSlug: organization.slug }}
        aria-label={`Open the organization workspace for ${name}`}
        className='flex h-full items-start gap-3 rounded-md border bg-card p-4 text-card-foreground transition-colors outline-none hover:border-ring/60 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/50'
      >
        <Avatar className='size-9 shrink-0 rounded-md border border-border'>
          {organization.logo ? (
            <AvatarImage src={imageUrl(organization.logo)} alt='' />
          ) : null}
          <AvatarFallback className='rounded-md text-xs'>
            {organizationInitials(organization)}
          </AvatarFallback>
        </Avatar>
        <span className='flex min-w-0 flex-col gap-1 text-start'>
          <span className='font-medium break-words'>{name}</span>
          <span className='text-sm break-all text-muted-foreground'>
            /{organization.slug}
          </span>
        </span>
      </Link>
    </li>
  )
}

/**
 * Native membership list for the personal dashboard. Shares the global
 * membership query with the directory and the switcher.
 */
export function OrganizationCards() {
  const organizations = useOrganizationMemberships()

  return (
    <section aria-labelledby='organizations-heading' className='space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 id='organizations-heading' className='text-xl font-semibold'>
            Your organizations
          </h2>
          <p className='text-sm text-muted-foreground'>
            Native memberships on this account. Open an organization workspace
            from its card; activation is handled by the organization boundary.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Button variant='outline' asChild>
            <Link to='/organization'>Organization directory</Link>
          </Button>
          <CreateOrganizationSheet />
        </div>
      </div>
      {organizations.isPending ? (
        <p role='status'>Loading organizations…</p>
      ) : null}
      {organizations.isError ? (
        <div role='alert' className='space-y-2'>
          <p>
            Could not load organizations. {errorMessage(organizations.error)}
          </p>
          <Button
            variant='outline'
            onClick={() => void organizations.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}
      {organizations.isSuccess ? (
        organizations.data.length === 0 ? (
          <p className='rounded-md border border-border p-4 text-sm text-muted-foreground'>
            You do not belong to an organization yet. Create one with the button
            above to get started.
          </p>
        ) : (
          <ul className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
            {organizations.data.map((organization) => (
              <OrganizationCard
                key={organization.id}
                organization={organization}
              />
            ))}
          </ul>
        )
      ) : null}
    </section>
  )
}
