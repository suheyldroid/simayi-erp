import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { isAdministrator, sessionQuery } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { UserRequestError, usersApi } from './api'
import { AccountProfileForm } from './components/account-profile-form'
import { UserCredentialsForm } from './components/user-credentials-form'
import { UserStatusDialog } from './components/user-status-dialog'
import type { User } from './model'

export function UserDetail() {
  const { userId } = getRouteApi(
    '/_authenticated/_system/settings/system/users/$userId'
  ).useParams()
  const id = userId
  const invalidId = id.trim().length === 0
  const session = useQuery(sessionQuery)
  const platformAdmin = session.isSuccess && isAdministrator(session.data?.user)
  const sessionUserId = session.data?.user.id ?? ''
  const details = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersApi.get(id),
    enabled: platformAdmin && !invalidId,
    refetchOnWindowFocus: false,
  })
  const detailStatus =
    details.error instanceof UserRequestError ? details.error.status : undefined
  const user = details.data
  return (
    <section className='space-y-6'>
      <div>
        <Link
          to='/settings/system/users'
          className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
        >
          Back to users
        </Link>
        <h2 className='mt-2 text-2xl font-bold'>User details</h2>
      </div>
      {session.isPending ? <p role='status'>Loading account…</p> : null}
      {session.isError ? (
        <p role='alert'>
          Could not load your account.{' '}
          <Button variant='outline' onClick={() => void session.refetch()}>
            Retry
          </Button>
        </p>
      ) : null}
      {session.isSuccess && session.data && !platformAdmin ? (
        <p role='alert'>Platform administrators only.</p>
      ) : null}
      {platformAdmin && invalidId ? <p role='alert'>User not found.</p> : null}
      {platformAdmin && !invalidId && details.isPending ? (
        <p role='status'>Loading user…</p>
      ) : null}
      {platformAdmin && details.isError && detailStatus === 404 ? (
        <p role='alert'>User not found.</p>
      ) : null}
      {platformAdmin && details.isError && detailStatus === 403 ? (
        <p role='alert'>You do not have access to this account.</p>
      ) : null}
      {platformAdmin &&
      details.isError &&
      detailStatus !== 404 &&
      detailStatus !== 403 ? (
        <p role='alert'>
          Could not load this user.{' '}
          <Button variant='outline' onClick={() => void details.refetch()}>
            Retry
          </Button>
        </p>
      ) : null}
      {platformAdmin && user && !details.isError ? (
        // Remount on an identity or record boundary so open sheets and
        // pending form state cannot carry over to another account.
        <AccountPanel key={`${sessionUserId}:${user.id}`} user={user} />
      ) : null}
    </section>
  )
}

function AccountPanel({ user }: { user: User }) {
  const [statusOpen, setStatusOpen] = useState(false)
  const [sheet, setSheet] = useState<'profile' | 'password' | null>(null)
  const [profilePending, setProfilePending] = useState(false)
  const deactivating = user.isActive && !user.banned
  return (
    <>
      <section className='space-y-4 rounded-md border border-border p-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <h3 className='text-xl font-semibold'>Account details</h3>
          <Button variant='outline' onClick={() => setSheet('profile')}>
            Edit profile
          </Button>
        </div>
        <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
          <dt>Email</dt>
          <dd className='break-all'>{user.email}</dd>
          <dt>Role</dt>
          <dd>{user.role ?? '—'}</dd>
          <dt>Status</dt>
          <dd>
            {user.banned ? 'Banned' : user.isActive ? 'Active' : 'Inactive'}
          </dd>
          <dt>Email verified</dt>
          <dd>{user.emailVerified ? 'Yes' : 'No'}</dd>
          <dt>Created</dt>
          <dd>{new Date(user.createdAt).toLocaleString()}</dd>
          <dt>Updated</dt>
          <dd>{new Date(user.updatedAt).toLocaleString()}</dd>
          {user.banReason ? (
            <>
              <dt>Ban reason</dt>
              <dd>{user.banReason}</dd>
            </>
          ) : null}
        </dl>
      </section>
      <section className='space-y-4'>
        <h3 className='text-xl font-semibold'>Account actions</h3>
        <div className='flex flex-wrap gap-2'>
          <Button
            variant='outline'
            onClick={() => setStatusOpen(true)}
            disabled={deactivating && isAdministrator(user)}
            title={
              deactivating && isAdministrator(user)
                ? 'Administrator accounts cannot be deactivated here'
                : undefined
            }
          >
            {deactivating ? 'Deactivate' : 'Activate'}
          </Button>
          <Button variant='outline' onClick={() => setSheet('password')}>
            Reset password
          </Button>
        </div>
      </section>
      <UserStatusDialog
        user={statusOpen ? user : null}
        onClose={() => setStatusOpen(false)}
      />
      <Sheet
        open={sheet === 'profile'}
        onOpenChange={(open) => {
          if (!open && profilePending) return
          if (!open) setSheet(null)
        }}
      >
        <SheetContent
          className='flex w-full flex-col sm:max-w-md'
          onEscapeKeyDown={(event) => {
            if (profilePending) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (profilePending) event.preventDefault()
          }}
        >
          <SheetHeader>
            <SheetTitle>Edit account profile</SheetTitle>
            <SheetDescription>
              Update the name or upload an avatar for {user.email}.
            </SheetDescription>
          </SheetHeader>
          {sheet === 'profile' ? (
            <AccountProfileForm
              key={user.id}
              user={user}
              onSaved={() => setSheet(null)}
              onCancel={() => setSheet(null)}
              onPendingChange={setProfilePending}
            />
          ) : null}
        </SheetContent>
      </Sheet>
      <Sheet
        open={sheet === 'password'}
        onOpenChange={(open) => {
          if (!open) setSheet(null)
        }}
      >
        <SheetContent className='flex w-full flex-col sm:max-w-md'>
          <SheetHeader>
            <SheetTitle>Reset password</SheetTitle>
            <SheetDescription>
              Set a new password for {user.email} through Better Auth.
            </SheetDescription>
          </SheetHeader>
          {sheet === 'password' ? (
            <UserCredentialsForm
              key={user.id}
              target={user}
              onSaved={() => setSheet(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
