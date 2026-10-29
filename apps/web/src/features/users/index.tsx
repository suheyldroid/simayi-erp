import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isAdministrator, sessionQuery } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { usersApi } from './api'
import { UserCredentialsForm } from './components/user-credentials-form'
import { UserProfileDialog } from './components/user-profile-dialog'
import { UserStatusDialog } from './components/user-status-dialog'
import type { User } from './model'

export function Users() {
  const [page, setPage] = useState(0)
  const [credentialsTarget, setCredentialsTarget] = useState<
    User | 'new' | null
  >(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [statusTarget, setStatusTarget] = useState<User | null>(null)
  const { data: currentUser } = useQuery(sessionQuery)
  const users = useQuery({
    queryKey: ['users', page],
    queryFn: () => usersApi.list(page),
    enabled: isAdministrator(currentUser),
  })

  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div className='flex flex-wrap items-center justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold'>Users</h1>
            <p className='text-muted-foreground'>
              Manage user profiles and account status.
            </p>
          </div>
          {isAdministrator(currentUser) && (
            <Button onClick={() => setCredentialsTarget('new')}>
              Create user
            </Button>
          )}
        </div>
        {!isAdministrator(currentUser) ? (
          <p role='alert'>Administrator access required.</p>
        ) : (
          <>
            {users.isPending && <p role='status'>Loading users…</p>}
            {users.isError && (
              <div role='alert'>
                Unable to load users.{' '}
                <Button variant='outline' onClick={() => void users.refetch()}>
                  Retry
                </Button>
              </div>
            )}
            {users.data && (
              <>
                <p className='text-sm text-muted-foreground'>
                  {users.data.total} users
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.data.users.map((user) => {
                      const active = user.isActive && !user.banned
                      return (
                        <TableRow key={user.id}>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {isAdministrator(user) ? 'Administrator' : 'User'}
                          </TableCell>
                          <TableCell>
                            {active ? 'Active' : 'Inactive'}
                          </TableCell>
                          <TableCell>
                            <div className='flex flex-wrap gap-2'>
                              <Button
                                variant='outline'
                                onClick={() => setProfileId(user.id)}
                                aria-label={`View or edit ${user.email}`}
                              >
                                Details / edit
                              </Button>
                              <Button
                                variant='outline'
                                onClick={() => setStatusTarget(user)}
                                disabled={active && isAdministrator(user)}
                                title={
                                  active && isAdministrator(user)
                                    ? 'Administrator accounts cannot be deactivated here'
                                    : undefined
                                }
                                aria-label={`${active ? 'Deactivate' : 'Activate'} ${user.email}`}
                              >
                                {active ? 'Deactivate' : 'Activate'}
                              </Button>
                              <Button
                                variant='outline'
                                onClick={() => setCredentialsTarget(user)}
                                aria-label={`Reset password for ${user.email}`}
                              >
                                Reset password
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {!users.data.users.length && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          No users on this page.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </>
            )}
            <div className='flex items-center gap-4'>
              <Button
                variant='outline'
                disabled={!page || users.isFetching}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span>Page {page + 1}</span>
              <Button
                variant='outline'
                disabled={
                  users.isFetching ||
                  !users.data ||
                  (page + 1) * users.data.limit >= users.data.total
                }
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </Main>
      <UserProfileDialog
        userId={profileId}
        onClose={() => setProfileId(null)}
      />
      <UserStatusDialog
        user={statusTarget}
        onClose={() => setStatusTarget(null)}
      />
      <Dialog
        open={credentialsTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCredentialsTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {credentialsTarget === 'new' ? 'Create user' : 'Reset password'}
            </DialogTitle>
            <DialogDescription>
              {credentialsTarget === 'new'
                ? 'Create a regular user through Better Auth.'
                : `Set a new password for ${credentialsTarget?.email ?? ''} through Better Auth.`}
            </DialogDescription>
          </DialogHeader>
          {credentialsTarget && (
            <UserCredentialsForm
              key={credentialsTarget === 'new' ? 'new' : credentialsTarget.id}
              target={credentialsTarget}
              onSaved={() => setCredentialsTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
