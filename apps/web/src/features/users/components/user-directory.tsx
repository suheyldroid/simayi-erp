import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isAdministrator } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usersApi } from '../api'
import type { User } from '../model'
import { PageControls } from './page-controls'

export function UserDirectory({
  administrator,
  onProfile,
  onStatus,
  onCredentials,
}: {
  administrator: boolean
  onProfile: (id: string) => void
  onStatus: (user: User) => void
  onCredentials: (user: User | 'new') => void
}) {
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const users = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => usersApi.list(page, search),
  })
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap gap-3'>
        <form
          className='flex gap-2'
          onSubmit={(event) => {
            event.preventDefault()
            setPage(0)
            setSearch(draft)
          }}
        >
          <Input
            aria-label='Search directory'
            placeholder='Name or email'
            maxLength={150}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button variant='outline'>Find</Button>
        </form>
        {administrator && (
          <Button onClick={() => onCredentials('new')}>Create user</Button>
        )}
      </div>
      {users.isPending && <p role='status'>Loading users…</p>}
      {users.isError && (
        <p role='alert'>
          Unable to load users.{' '}
          <Button variant='outline' onClick={() => void users.refetch()}>
            Retry
          </Button>
        </p>
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
                    <TableCell>{active ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell>
                      <div className='flex flex-wrap gap-2'>
                        <Button
                          variant='outline'
                          onClick={() => onProfile(user.id)}
                          aria-label={`View or edit ${user.email}`}
                        >
                          Profile / details
                        </Button>
                        {administrator && (
                          <>
                            <Button
                              variant='outline'
                              onClick={() => onStatus(user)}
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
                              onClick={() => onCredentials(user)}
                              aria-label={`Reset password for ${user.email}`}
                            >
                              Reset password
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {!users.data.users.length && (
                <TableRow>
                  <TableCell colSpan={5}>No users on this page.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </>
      )}
      <PageControls
        page={page}
        loading={users.isFetching}
        hasNext={
          !!users.data && (page + 1) * users.data.limit < users.data.total
        }
        onChange={setPage}
      />
    </div>
  )
}
