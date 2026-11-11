import { useQuery } from '@tanstack/react-query'
import { isAdministrator, sessionQuery } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { UserDirectory } from './components/user-directory'

/**
 * Platform account list. Rendered inside the shared settings frame, which owns
 * the page header, the categorized navigation and the nested administrator
 * gate.
 */
export function Users() {
  const session = useQuery(sessionQuery)
  const platformAdmin = session.isSuccess && isAdministrator(session.data?.user)
  const adminId = session.data?.user.id
  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>Users</h2>
        <p className='text-muted-foreground'>
          Platform accounts. Create users and manage their profile, password, or
          status from Actions.
        </p>
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
        <p>Platform administrators only.</p>
      ) : null}
      {platformAdmin && adminId ? (
        // Remount on an identity boundary so pending directory and sheet
        // state can never carry over to another administrator.
        <UserDirectory key={adminId} />
      ) : null}
    </section>
  )
}
