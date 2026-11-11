import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { isAdministrator } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { usersApi, type UserSearchField } from '../api'
import type { User } from '../model'
import { PageControls } from './page-controls'
import { UserCredentialsForm } from './user-credentials-form'

export function UserDirectory() {
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [field, setField] = useState<UserSearchField>('name')
  const [creating, setCreating] = useState(false)
  const users = useQuery({
    queryKey: ['users', page, search, field],
    queryFn: () => usersApi.list(page, search, field),
  })
  const columns = useMemo<SortableColumn<User>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (user) => user.name || user.email,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'email',
        header: 'Email',
        accessorFn: (user) => user.email,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'role',
        header: 'Role',
        accessorFn: (user) =>
          isAdministrator(user) ? 'Administrator' : 'User',
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (user) =>
          user.isActive && !user.banned ? 'Active' : 'Inactive',
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { label: 'Actions', width: 110 },
        cell: ({ row }) => {
          const user = row.original
          const label = user.name || user.email
          return (
            <Link
              to='/settings/system/users/$userId'
              params={{ userId: user.id }}
              aria-label={`Details for ${label}`}
              className='inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
            >
              Details
            </Link>
          )
        },
      },
    ],
    []
  )
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <form
          className='flex flex-wrap gap-2'
          onSubmit={(event) => {
            event.preventDefault()
            setPage(0)
            setSearch(draft)
          }}
        >
          <Input
            aria-label='Search directory'
            placeholder={`Search by ${field}`}
            maxLength={150}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Select
            value={field}
            onValueChange={(value) => {
              if (value === 'name' || value === 'email') {
                setField(value)
                setPage(0)
              }
            }}
          >
            <SelectTrigger className='w-32' aria-label='Search field'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='name'>Name</SelectItem>
              <SelectItem value='email'>Email</SelectItem>
            </SelectContent>
          </Select>
          <Button variant='outline'>Find</Button>
        </form>
        <Button onClick={() => setCreating(true)}>Create user</Button>
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
            {users.data.total} users. Sorting applies to this page only.
          </p>
          <SortableDataTable
            data={users.data.users}
            columns={columns}
            getRowId={(user) => user.id}
            caption='Platform accounts'
            emptyMessage='No users match this search.'
          />
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
      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent className='flex w-full flex-col sm:max-w-md'>
          <SheetHeader>
            <SheetTitle>Create user</SheetTitle>
            <SheetDescription>
              Create a regular user through Better Auth. This does not add the
              user to an organization.
            </SheetDescription>
          </SheetHeader>
          {creating ? (
            <UserCredentialsForm
              key='new'
              target='new'
              onSaved={() => setCreating(false)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
