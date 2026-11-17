import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sessionQuery, type SessionUser } from '@/lib/auth'
import { locale, t } from '@/lib/i18n'
import { imageUrl } from '@/lib/image-url'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ContentSection } from '../components/content-section'
import { avatarReferencePrefix } from './avatar-api'
import { ProfileForm } from './profile-form'

/**
 * Personal profile. It reads only the native account session, so it works for
 * any signed-in user without an active organization or platform role.
 */
export function SettingsProfile() {
  const session = useQuery(sessionQuery)
  const user = session.data?.user

  return (
    <ContentSection
      title={t('global:settings.profile.title')}
      desc={t('global:settings.profile.description')}
    >
      <div className='space-y-4'>
        {session.isPending ? (
          <p role='status'>{t('global:settings.profile.loading')}</p>
        ) : null}
        {session.isError ? (
          <div role='alert' className='space-y-2'>
            <p>{t('global:settings.profile.loadFailed')}</p>
            <Button
              variant='outline'
              size='sm'
              onClick={() => void session.refetch()}
            >
              {t('global:shared.retry')}
            </Button>
          </div>
        ) : null}
        {session.isSuccess && user == null ? (
          <p role='alert'>{t('global:settings.profile.sessionUnavailable')}</p>
        ) : null}
        {session.isSuccess && user ? (
          // Remount on the account identity boundary so a pending edit can
          // never carry over to another signed-in user.
          <ProfileSummary key={user.id} user={user} />
        ) : null}
      </div>
    </ContentSection>
  )
}

function ProfileSummary({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const image = user.image ?? null
  const initials = user.name.trim().slice(0, 2).toLocaleUpperCase(locale) || 'U'

  function changeOpen(next: boolean) {
    // A native update cannot be cancelled once sent; keep the Sheet mounted
    // until it settles and retry state is available.
    if (!next && pending) return
    setOpen(next)
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-center gap-4'>
        <Avatar className='size-16 rounded-lg'>
          <AvatarImage
            src={image ? imageUrl(image) : undefined}
            alt=''
            crossOrigin={
              image?.startsWith(avatarReferencePrefix)
                ? 'use-credentials'
                : undefined
            }
          />
          <AvatarFallback className='rounded-lg'>{initials}</AvatarFallback>
        </Avatar>
        <div className='min-w-0 space-y-1'>
          <p className='font-medium break-all'>{user.name}</p>
          <p className='text-sm break-all text-muted-foreground'>
            {user.email}
          </p>
        </div>
        <Button
          variant='outline'
          className='w-full sm:ms-auto sm:w-auto'
          onClick={() => setOpen(true)}
        >
          {t('global:settings.profile.editTrigger')}
        </Button>
      </div>
      <p className='text-sm text-muted-foreground'>
        {t('global:settings.profile.emailReadOnly')}
      </p>

      <Sheet open={open} onOpenChange={changeOpen}>
        <SheetContent
          className='flex w-full flex-col gap-0 sm:max-w-md'
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (pending) event.preventDefault()
          }}
        >
          <SheetHeader>
            <SheetTitle>{t('global:settings.profile.sheetTitle')}</SheetTitle>
            <SheetDescription>
              {t('global:settings.profile.sheetDescription', {
                email: user.email,
              })}
            </SheetDescription>
          </SheetHeader>
          {open ? (
            <ProfileForm
              key={`${user.id}:${open}`}
              user={user}
              onSaved={() => setOpen(false)}
              onCancel={() => setOpen(false)}
              onPendingChange={setPending}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
