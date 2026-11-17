import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { locale, t } from '@/lib/i18n'
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
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, unitApi } from './api'
import { UnitForm } from './components/unit-form'
import type { Unit } from './model'

const PAGE_SIZE = 20

type Status = 'all' | 'active' | 'inactive'

export function Units() {
  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>{t('catalog:units.title')}</h2>
        <p className='text-muted-foreground'>
          {t('catalog:units.description')}
        </p>
      </div>
      <UnitDirectory />
    </section>
  )
}

function CreateUnitAction() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type='button' onClick={() => setOpen(true)}>
        {t('catalog:units.new')}
      </Button>
      <UnitForm
        draft={open ? { mode: 'create' } : null}
        canSubmit={open}
        onOpenChange={setOpen}
        onSaved={(saved) => {
          void navigate({
            to: '/settings/system/units/$unitId',
            params: { unitId: saved.uuid },
          })
        }}
      />
    </>
  )
}

function UnitDirectory() {
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const units = useQuery({
    queryKey: ['unit', 'list', page, search, status],
    queryFn: () =>
      unitApi.units({
        page,
        search,
        limit: PAGE_SIZE,
        ...(status === 'all' ? {} : { active: status === 'active' }),
      }),
  })
  const columns = useMemo<SortableColumn<Unit>[]>(
    () => [
      {
        id: 'name',
        header: t('catalog:units.fields.name'),
        accessorFn: (unit) => unit.name,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'code',
        header: t('catalog:units.fields.code'),
        accessorFn: (unit) => unit.code,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'divisible',
        header: t('catalog:units.fields.divisible'),
        accessorFn: (unit) =>
          unit.divisible
            ? t('catalog:units.divisibleYes')
            : t('catalog:units.divisibleNo'),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'status',
        header: t('catalog:units.fields.status'),
        accessorFn: (unit) =>
          unit.active
            ? t('catalog:common.active')
            : t('catalog:common.inactive'),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'actions',
        header: t('catalog:common.actions'),
        enableSorting: false,
        meta: { label: t('catalog:common.actions'), width: 110 },
        cell: ({ row }) => (
          <Link
            to='/settings/system/units/$unitId'
            params={{ unitId: row.original.uuid }}
            aria-label={t('catalog:units.viewDetails', {
              name: row.original.name,
              code: row.original.code,
            })}
            className='inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            {t('catalog:common.details')}
          </Link>
        ),
      },
    ],
    []
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
            aria-label={t('catalog:units.searchLabel')}
            placeholder={t('catalog:units.searchPlaceholder')}
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className='max-w-sm'
          />
          <Select
            value={status}
            onValueChange={(value) => {
              if (
                value === 'all' ||
                value === 'active' ||
                value === 'inactive'
              ) {
                setStatus(value)
                setPage(0)
              }
            }}
          >
            <SelectTrigger
              className='w-40'
              aria-label={t('catalog:units.statusLabel')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>
                {t('catalog:units.statusAll')}
              </SelectItem>
              <SelectItem value='active'>
                {t('catalog:common.active')}
              </SelectItem>
              <SelectItem value='inactive'>
                {t('catalog:common.inactive')}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button variant='outline'>{t('catalog:common.find')}</Button>
        </form>
        <CreateUnitAction />
      </div>
      {units.isPending && <p role='status'>{t('catalog:units.loading')}</p>}
      {units.isError && (
        <p role='alert'>
          {errorMessage(units.error)}{' '}
          <Button variant='outline' onClick={() => void units.refetch()}>
            {t('catalog:common.retry')}
          </Button>
        </p>
      )}
      {units.data && (
        <>
          <p className='text-sm text-muted-foreground'>
            {t('catalog:units.summary', {
              total: units.data.total.toLocaleString(locale),
              sortingNote: t('catalog:common.sortingNote'),
            })}
          </p>
          <p className='text-sm text-muted-foreground'>
            {t('catalog:units.openHint')}
          </p>
          <SortableDataTable
            data={units.data.items}
            columns={columns}
            getRowId={(unit) => unit.uuid}
            caption={t('catalog:units.caption')}
            emptyMessage={t('catalog:units.empty')}
          />
        </>
      )}
      <PageControls
        page={page}
        loading={units.isFetching}
        hasNext={
          !!units.data && (page + 1) * units.data.limit < units.data.total
        }
        onChange={setPage}
      />
    </div>
  )
}
