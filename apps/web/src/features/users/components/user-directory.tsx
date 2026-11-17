import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { isAdministrator } from '@/lib/auth'
import { t } from '@/lib/i18n'
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
        header: t('global:users.directory.columns.name'),
        accessorFn: (user) => user.name || user.email,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'email',
        header: t('global:users.directory.columns.email'),
        accessorFn: (user) => user.email,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'role',
        header: t('global:users.directory.columns.role'),
        accessorFn: (user) =>
          isAdministrator(user)
            ? t('global:users.roleKind.administrator')
            : t('global:users.roleKind.user'),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'status',
        header: t('global:users.directory.columns.status'),
        accessorFn: (user) =>
          user.isActive && !user.banned
            ? t('global:users.status.active')
            : t('global:users.status.inactive'),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'actions',
        header: t('global:users.directory.columns.actions'),
        enableSorting: false,
        meta: {
          label: t('global:users.directory.columns.actions'),
          width: 110,
        },
        cell: ({ row }) => {
          const user = row.original
          const label = user.name || user.email
          return (
            <Link
              to='/settings/system/users/$userId'
              params={{ userId: user.id }}
              aria-label={t('global:users.directory.detailsLabel', {
                name: label,
              })}
              className='inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
            >
              {t('global:shared.details')}
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
            aria-label={t('global:users.directory.searchLabel')}
            placeholder={t('global:users.directory.searchPlaceholder', {
              field: t(`global:users.directory.fields.${field}`),
            })}
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
            <SelectTrigger
              className='w-32'
              aria-label={t('global:users.directory.searchFieldLabel')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='name'>
                {t('global:users.directory.columns.name')}
              </SelectItem>
              <SelectItem value='email'>
                {t('global:users.directory.columns.email')}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button variant='outline'>{t('global:users.directory.find')}</Button>
        </form>
        <Button onClick={() => setCreating(true)}>
          {t('global:users.directory.createUser')}
        </Button>
      </div>
      {users.isPending && (
        <p role='status'>{t('global:users.directory.loading')}</p>
      )}
      {users.isError && (
        <p role='alert'>
          {t('global:users.directory.loadFailed')}{' '}
          <Button variant='outline' onClick={() => void users.refetch()}>
            {t('global:shared.retry')}
          </Button>
        </p>
      )}
      {users.data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {t('global:users.directory.count', { count: users.data.total })}
          </p>
          <SortableDataTable
            data={users.data.users}
            columns={columns}
            getRowId={(user) => user.id}
            caption={t('global:users.directory.caption')}
            emptyMessage={t('global:users.directory.empty')}
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
            <SheetTitle>{t('global:users.directory.createUser')}</SheetTitle>
            <SheetDescription>
              {t('global:users.directory.createDescription')}
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
