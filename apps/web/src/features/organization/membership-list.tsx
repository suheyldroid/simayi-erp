import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import type { OrganizationRecord } from './model'

function organizationName(organization: OrganizationRecord) {
  return (
    organization.name || organization.slug || organization.id || 'Organization'
  )
}

export function MembershipOrganizationsTable({
  organizations,
  activeOrganizationId,
  caption,
  emptyMessage,
}: {
  organizations: OrganizationRecord[]
  activeOrganizationId: string | null
  caption: string
  emptyMessage: string
}) {
  const columns = useMemo<SortableColumn<OrganizationRecord>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        accessorFn: (organization) => organizationName(organization),
        cell: ({ row }) => (
          <span className='font-medium'>{organizationName(row.original)}</span>
        ),
      },
      {
        id: 'slug',
        header: 'Slug',
        accessorFn: (organization) => organization.slug,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (organization) =>
          organization.id === activeOrganizationId
            ? 'Active organization'
            : 'Member',
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        meta: { label: 'Actions' },
        cell: ({ row }) => {
          const organization = row.original
          const name = organizationName(organization)
          if (!organization.slug) return null
          return (
            <div className='flex flex-wrap items-center gap-3'>
              <Link
                to='/o/$organizationSlug'
                params={{ organizationSlug: organization.slug }}
                aria-label={`Open the organization page for ${name}`}
                className='inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
              >
                Details
              </Link>
            </div>
          )
        },
      },
    ],
    [activeOrganizationId]
  )

  return (
    <SortableDataTable
      data={organizations}
      columns={columns}
      getRowId={(organization) => organization.id}
      caption={caption}
      emptyMessage={emptyMessage}
    />
  )
}
