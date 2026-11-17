import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { t } from '@/lib/i18n'
import { imageUrl } from '@/lib/image-url'
import { organizationLocation } from '@/lib/organization-navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { organizationLogoPrefix } from './logo-api'
import { organizationInitials, type OrganizationRecord } from './model'

function organizationName(organization: OrganizationRecord) {
  return (
    organization.name ||
    organization.slug ||
    organization.id ||
    t('global:organizations.unnamed')
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
        id: 'logo',
        header: t('global:organizations.columns.logo'),
        enableSorting: false,
        meta: { label: t('global:organizations.columns.logo'), width: 56 },
        cell: ({ row }) => {
          const organization = row.original
          return (
            <Avatar className='size-8 rounded-md border border-border'>
              {organization.logo ? (
                <AvatarImage
                  key={organization.logo}
                  src={imageUrl(organization.logo)}
                  alt=''
                  className='object-contain'
                  crossOrigin={
                    organization.logo.startsWith(organizationLogoPrefix)
                      ? 'use-credentials'
                      : undefined
                  }
                />
              ) : null}
              <AvatarFallback className='rounded-md text-xs'>
                {organizationInitials(organization)}
              </AvatarFallback>
            </Avatar>
          )
        },
      },
      {
        id: 'name',
        header: t('global:organizations.columns.name'),
        accessorFn: (organization) => organizationName(organization),
        cell: ({ row }) => (
          <span className='font-medium'>{organizationName(row.original)}</span>
        ),
      },
      {
        id: 'slug',
        header: t('global:organizations.columns.slug'),
        accessorFn: (organization) => organization.slug,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'status',
        header: t('global:organizations.columns.status'),
        accessorFn: (organization) =>
          organization.id === activeOrganizationId
            ? t('global:organizations.statusActive')
            : t('global:organizations.statusMember'),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'actions',
        header: t('global:organizations.columns.actions'),
        enableSorting: false,
        meta: { label: t('global:organizations.columns.actions') },
        cell: ({ row }) => {
          const organization = row.original
          const name = organizationName(organization)
          if (!organization.slug) return null
          return (
            <div className='flex flex-wrap items-center gap-3'>
              <Link
                {...organizationLocation(organization.slug, null, '')}
                aria-label={t('global:organizations.detailsLabel', { name })}
                className='inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
              >
                {t('global:organizations.details')}
              </Link>
              <Link
                {...organizationLocation(organization.slug, null, '/settings')}
                aria-label={t('global:organizations.settingsLabel', { name })}
                className='inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
              >
                {t('global:organizations.settings')}
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
