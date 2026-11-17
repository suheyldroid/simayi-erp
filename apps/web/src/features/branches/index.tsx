import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useOptionalBranch } from '@/lib/branch-boundary'
import { locale, t } from '@/lib/i18n'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { organizationLocation } from '@/lib/organization-navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { PageControls } from '@/features/users/components/page-controls'
import { branchesListQueryOptions, errorMessage } from './api'
import { BranchForm } from './components/branch-form'
import type { Branch } from './model'

const PAGE_SIZE = 20

export function Branches() {
  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>{t('catalog:branches.title')}</h2>
        <p className='text-muted-foreground'>
          {t('catalog:branches.description')}
        </p>
      </div>
      <BranchDirectory />
    </section>
  )
}

function CreateBranchAction() {
  const navigate = useNavigate()
  const organizationSlug = useOrganizationSlug()
  const branchUuid = useOptionalBranch()?.branchUuid ?? null
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type='button' onClick={() => setOpen(true)}>
        {t('catalog:branches.new')}
      </Button>
      <BranchForm
        draft={open ? { mode: 'create' } : null}
        canSubmit={open}
        onOpenChange={setOpen}
        onSaved={(saved) => {
          void navigate(
            organizationLocation(
              organizationSlug,
              branchUuid,
              '/settings/branches/$branchId',
              { branchId: saved.uuid }
            )
          )
        }}
      />
    </>
  )
}

function BranchDirectory() {
  const organizationSlug = useOrganizationSlug()
  const branchUuid = useOptionalBranch()?.branchUuid ?? null
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const branches = useQuery(
    branchesListQueryOptions({ page, search, limit: PAGE_SIZE })
  )
  const columns = useMemo<SortableColumn<Branch>[]>(
    () => [
      {
        id: 'name',
        header: t('catalog:common.name'),
        accessorFn: (branch) => branch.name,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'status',
        header: t('catalog:common.status'),
        accessorFn: (branch) =>
          branch.active
            ? t('catalog:common.active')
            : t('catalog:common.inactive'),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'version',
        header: t('catalog:common.version'),
        accessorFn: (branch) => branch.version,
        meta: { numeric: true },
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'actions',
        header: t('catalog:common.actions'),
        enableSorting: false,
        meta: { label: t('catalog:common.actions'), width: 110 },
        cell: ({ row }) => (
          <Link
            {...organizationLocation(
              organizationSlug,
              branchUuid,
              '/settings/branches/$branchId',
              { branchId: row.original.uuid }
            )}
            aria-label={t('catalog:branches.viewDetails', {
              name: row.original.name,
            })}
            className='inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            {t('catalog:common.details')}
          </Link>
        ),
      },
    ],
    [organizationSlug, branchUuid]
  )
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <form
          className='flex flex-wrap items-center gap-2'
          onSubmit={(event) => {
            event.preventDefault()
            setPage(0)
            setSearch(draft)
          }}
        >
          <Input
            aria-label={t('catalog:branches.searchLabel')}
            placeholder={t('catalog:branches.searchPlaceholder')}
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className='max-w-sm'
          />
          <Button variant='outline'>{t('catalog:common.find')}</Button>
        </form>
        <CreateBranchAction />
      </div>
      {branches.isPending && (
        <p role='status'>{t('catalog:branches.loading')}</p>
      )}
      {branches.isError && (
        <p role='alert'>
          {errorMessage(branches.error)}{' '}
          <Button variant='outline' onClick={() => void branches.refetch()}>
            {t('catalog:common.retry')}
          </Button>
        </p>
      )}
      {branches.data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {t('catalog:branches.summary', {
              total: branches.data.total.toLocaleString(locale),
              sortingNote: t('catalog:common.sortingNote'),
            })}
          </p>
          <p className='text-sm text-muted-foreground'>
            {t('catalog:branches.openHint')}
          </p>
          <SortableDataTable
            data={branches.data.items}
            columns={columns}
            getRowId={(branch) => branch.uuid}
            caption={t('catalog:branches.caption')}
            emptyMessage={t('catalog:branches.empty')}
          />
        </>
      )}
      <PageControls
        page={page}
        loading={branches.isFetching}
        hasNext={
          !!branches.data &&
          (page + 1) * branches.data.limit < branches.data.total
        }
        onChange={setPage}
      />
    </div>
  )
}
