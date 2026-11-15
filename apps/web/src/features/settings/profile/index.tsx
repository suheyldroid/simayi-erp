import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sessionQuery, type SessionUser } from '@/lib/auth'
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
      title='Profile'
      desc='Your native account identity. Name and avatar are shown across the app.'
    >
      <div className='space-y-4'>
        {session.isPending ? <p role='status'>Loading your account…</p> : null}
        {session.isError ? (
          <div role='alert' className='space-y-2'>
            <p>Could not load your account.</p>
            <Button
              variant='outline'
              size='sm'
              onClick={() => void session.refetch()}
            >
              Retry
            </Button>
          </div>
        ) : null}
        {session.isSuccess && user == null ? (
          <p role='alert'>Your account session is not available.</p>
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
  const initials = user.name.trim().slice(0, 2).toUpperCase() || 'U'

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
          Edit profile
        </Button>
      </div>
      <p className='text-sm text-muted-foreground'>
        Email is read-only. Email changes are not enabled in this deployment:
        Better Auth&apos;s change-email flow is off and no verification email
        sender is configured.
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
            <SheetTitle>Edit profile</SheetTitle>
            <SheetDescription>
              Update the name or upload an avatar for {user.email}.
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
