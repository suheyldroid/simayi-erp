import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { organizationSessionQuery } from '@/lib/auth'
import { useOrganizationBoundary } from '@/lib/organization-boundary'
import { Button } from '@/components/ui/button'
import { organizationApi } from './api'
import { splitMemberRoles } from './model'
import {
  DeleteOrganizationButton,
  EditOrganizationSheet,
} from './organization-forms'
import {
  OrganizationSettingsAccessContext,
  type OrganizationSettingsAccess,
} from './settings-access'

/**
 * Shared organization settings gate and header. Details, Members and Teams are
 * sibling routes under the same verified slug boundary, so they must all prove
 * the identical organization before any action or content renders.
 */
export function OrganizationSettingsPage({
  children,
}: {
  children?: ReactNode
}) {
  const { organizationId, organization } = useOrganizationBoundary()
  const session = useQuery(organizationSessionQuery)
  const sessionData = session.isSuccess ? session.data : null
  // The live session must still prove this exact organization before any
  // editor can render: a retained cache entry never authorizes a mutation.
  const sessionVerified =
    sessionData !== null &&
    sessionData.session.activeOrganizationId === organizationId
  const membership = useQuery({
    queryKey: ['organization', organizationId, 'active-member'],
    queryFn: () => organizationApi.activeMember(),
  })
  // A failed refetch keeps the last `membership.data`, so gate editors on
  // success state, never on cached presence. The active-member response is
  // session-dependent: it must prove this exact organization and account
  // before any role, action or content derives from it.
  const sessionUserId = sessionData?.user.id ?? null
  const membershipVerified =
    sessionVerified &&
    membership.isSuccess &&
    membership.data.organizationId === organizationId &&
    membership.data.userId === sessionUserId
  const membershipMismatch =
    sessionVerified && membership.isSuccess && !membershipVerified
  const actorRoles = membershipVerified
    ? splitMemberRoles(membership.data.role)
    : []
  // Native owner/admin membership capabilities. The server keeps enforcing the
  // fine-grained native rules, including ownership transfer and last-owner.
  const canManage =
    membershipVerified &&
    actorRoles.some((role) => role === 'owner' || role === 'admin')
  const isOwner = membershipVerified && actorRoles.includes('owner')
  const access: OrganizationSettingsAccess | null =
    membershipVerified && sessionData
      ? {
          organizationId,
          organization,
          actorRoles,
          canManage,
          isOwner,
          activeTeamId: sessionData.session.activeTeamId ?? null,
          currentUserId: sessionData.user.id,
        }
      : null

  return (
    <section className='space-y-6'>
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0 space-y-1'>
          <div className='flex flex-wrap items-baseline gap-2'>
            <h2 className='text-2xl font-bold'>{organization.name}</h2>
            <span className='text-xs text-muted-foreground'>
              ID: <span className='font-mono break-all'>{organization.id}</span>
            </span>
          </div>
        </div>
        {access ? (
          <div className='flex flex-wrap items-center gap-2'>
            <EditOrganizationSheet
              key={organization.id}
              organization={organization}
              canUpdate={canManage}
            />
            <DeleteOrganizationButton
              key={`${organization.id}:delete`}
              organization={organization}
              canDelete={isOwner}
            />
          </div>
        ) : null}
      </header>
      {session.isPending ? <p role='status'>Loading your membership…</p> : null}
      {session.isError ? (
        <p role='alert'>
          Could not load your organization membership.{' '}
          <Button variant='outline' onClick={() => void session.refetch()}>
            Retry
          </Button>
        </p>
      ) : null}
      {membership.isPending ? (
        <p role='status'>Loading your membership…</p>
      ) : null}
      {membership.isError ? (
        <p role='alert'>
          Could not load your membership.{' '}
          <Button variant='outline' onClick={() => void membership.refetch()}>
            Retry
          </Button>
        </p>
      ) : null}
      {membershipMismatch ? (
        <p role='alert'>
          Your membership no longer matches the active session for this
          organization. Reload the page to verify your access again.{' '}
          <Button variant='outline' onClick={() => window.location.reload()}>
            Reload
          </Button>
        </p>
      ) : null}
      {access ? (
        <OrganizationSettingsAccessContext.Provider value={access}>
          {children}
        </OrganizationSettingsAccessContext.Provider>
      ) : null}
    </section>
  )
}
