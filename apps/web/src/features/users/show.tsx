import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { isAdministrator, sessionQuery } from '@/lib/auth'
import { locale, t } from '@/lib/i18n'
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
import { userRoleLabel, type User } from './model'

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
          {t('global:users.detail.backToUsers')}
        </Link>
        <h2 className='mt-2 text-2xl font-bold'>
          {t('global:users.detail.title')}
        </h2>
      </div>
      {session.isPending ? (
        <p role='status'>{t('global:shared.accountLoading')}</p>
      ) : null}
      {session.isError ? (
        <p role='alert'>
          {t('global:shared.accountLoadFailed')}{' '}
          <Button variant='outline' onClick={() => void session.refetch()}>
            {t('global:shared.retry')}
          </Button>
        </p>
      ) : null}
      {session.isSuccess && session.data && !platformAdmin ? (
        <p role='alert'>{t('global:users.directory.adminOnly')}</p>
      ) : null}
      {platformAdmin && invalidId ? (
        <p role='alert'>{t('global:users.detail.notFound')}</p>
      ) : null}
      {platformAdmin && !invalidId && details.isPending ? (
        <p role='status'>{t('global:users.detail.loadingUser')}</p>
      ) : null}
      {platformAdmin && details.isError && detailStatus === 404 ? (
        <p role='alert'>{t('global:users.detail.notFound')}</p>
      ) : null}
      {platformAdmin && details.isError && detailStatus === 403 ? (
        <p role='alert'>{t('global:users.detail.forbidden')}</p>
      ) : null}
      {platformAdmin &&
      details.isError &&
      detailStatus !== 404 &&
      detailStatus !== 403 ? (
        <p role='alert'>
          {t('global:users.detail.loadFailed')}{' '}
          <Button variant='outline' onClick={() => void details.refetch()}>
            {t('global:shared.retry')}
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
          <h3 className='text-xl font-semibold'>
            {t('global:users.detail.accountDetails')}
          </h3>
          <Button variant='outline' onClick={() => setSheet('profile')}>
            {t('global:users.detail.editProfile')}
          </Button>
        </div>
        <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
          <dt>{t('global:shared.email')}</dt>
          <dd className='break-all'>{user.email}</dd>
          <dt>{t('global:users.detail.role')}</dt>
          <dd>{userRoleLabel(user.role)}</dd>
          <dt>{t('global:users.detail.status')}</dt>
          <dd>
            {user.banned
              ? t('global:users.status.banned')
              : user.isActive
                ? t('global:users.status.active')
                : t('global:users.status.inactive')}
          </dd>
          <dt>{t('global:users.detail.emailVerified')}</dt>
          <dd>
            {user.emailVerified
              ? t('global:shared.yes')
              : t('global:shared.no')}
          </dd>
          <dt>{t('global:users.detail.created')}</dt>
          <dd>{new Date(user.createdAt).toLocaleString(locale)}</dd>
          <dt>{t('global:users.detail.updated')}</dt>
          <dd>{new Date(user.updatedAt).toLocaleString(locale)}</dd>
          {user.banReason ? (
            <>
              <dt>{t('global:users.detail.banReason')}</dt>
              <dd>{user.banReason}</dd>
            </>
          ) : null}
        </dl>
      </section>
      <section className='space-y-4'>
        <h3 className='text-xl font-semibold'>
          {t('global:users.detail.accountActions')}
        </h3>
        <div className='flex flex-wrap gap-2'>
          <Button
            variant='outline'
            onClick={() => setStatusOpen(true)}
            disabled={deactivating && isAdministrator(user)}
            title={
              deactivating && isAdministrator(user)
                ? t('global:users.detail.adminDeactivateBlocked')
                : undefined
            }
          >
            {deactivating
              ? t('global:users.detail.deactivate')
              : t('global:users.detail.activate')}
          </Button>
          <Button variant='outline' onClick={() => setSheet('password')}>
            {t('global:users.detail.resetPassword')}
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
            <SheetTitle>{t('global:users.detail.editProfileTitle')}</SheetTitle>
            <SheetDescription>
              {t('global:users.detail.editProfileDescription', {
                email: user.email,
              })}
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
            <SheetTitle>
              {t('global:users.detail.resetPasswordTitle')}
            </SheetTitle>
            <SheetDescription>
              {t('global:users.detail.resetPasswordDescription', {
                email: user.email,
              })}
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
