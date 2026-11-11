import { useQuery } from '@tanstack/react-query'
import { sessionQuery } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { ContentSection } from '../components/content-section'
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
          <ProfileForm key={user.id} user={user} />
        ) : null}
      </div>
    </ContentSection>
  )
}
