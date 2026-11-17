import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sessionQuery } from '@/lib/auth'
import { locale, t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { PageControls } from '@/features/users/components/page-controls'
import { MembershipOrganizationsTable } from './membership-list'
import { useOrganizationMemberships } from './membership-query'
import { CreateOrganizationSheet } from './organization-forms'

const PAGE_SIZE = 10

export function Organizations() {
  const session = useQuery(sessionQuery)
  const activeOrganizationId =
    session.data?.session.activeOrganizationId ?? null
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const organizations = useOrganizationMemberships()
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase(locale)
    // Slugs stay in their canonical ASCII form, so they match on the ASCII
    // needle only.
    const slugNeedle = search.trim().toLowerCase()
    if (!needle) return organizations.data ?? []
    return (organizations.data ?? []).filter(
      (organization) =>
        organization.name.toLocaleLowerCase(locale).includes(needle) ||
        organization.slug.toLowerCase().includes(slugNeedle)
    )
  }, [organizations.data, search])
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const hasNext = (page + 1) * PAGE_SIZE < filtered.length

  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>
            {t('global:organizations.title')}
          </h1>
          <p className='text-muted-foreground'>
            {t('global:organizations.description')}
          </p>
        </div>
        <section className='space-y-4'>
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
                aria-label={t('global:organizations.searchLabel')}
                placeholder={t('global:organizations.searchPlaceholder')}
                maxLength={100}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button variant='outline'>
                {t('global:organizations.find')}
              </Button>
            </form>
            <CreateOrganizationSheet />
          </div>
          {organizations.isPending ? (
            <p role='status'>{t('global:organizations.loading')}</p>
          ) : null}
          {organizations.isError ? (
            <p role='alert'>
              {t('global:organizations.loadFailed')}{' '}
              <Button
                variant='outline'
                onClick={() => void organizations.refetch()}
              >
                {t('global:shared.retry')}
              </Button>
            </p>
          ) : null}
          {organizations.isSuccess ? (
            <>
              <p className='text-sm text-muted-foreground'>
                {t('global:organizations.count', {
                  filtered: filtered.length,
                  total: organizations.data.length,
                })}
              </p>
              <p className='text-sm text-muted-foreground'>
                {t('global:organizations.detailsHint')}
              </p>
              <MembershipOrganizationsTable
                organizations={pageRows}
                activeOrganizationId={activeOrganizationId}
                caption={t('global:organizations.caption')}
                emptyMessage={
                  organizations.data.length === 0
                    ? t('global:organizations.emptyNone')
                    : t('global:organizations.emptyFiltered')
                }
              />
              <PageControls
                page={page}
                loading={organizations.isFetching}
                hasNext={hasNext}
                onChange={setPage}
              />
            </>
          ) : null}
        </section>
      </Main>
    </>
  )
}
