import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sessionQuery } from '@/lib/auth'
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
    const needle = search.trim().toLowerCase()
    if (!needle) return organizations.data ?? []
    return (organizations.data ?? []).filter(
      (organization) =>
        organization.name.toLowerCase().includes(needle) ||
        organization.slug.toLowerCase().includes(needle)
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
          <h1 className='text-2xl font-bold'>Organizations</h1>
          <p className='text-muted-foreground'>
            Every organization you belong to across this account. Open one to
            work inside it with its own records, members, teams, and roles.
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
                aria-label='Search organizations'
                placeholder='Search by name or slug'
                maxLength={100}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <Button variant='outline'>Find</Button>
            </form>
            <CreateOrganizationSheet />
          </div>
          {organizations.isPending ? (
            <p role='status'>Loading organizations…</p>
          ) : null}
          {organizations.isError ? (
            <p role='alert'>
              Could not load organizations.{' '}
              <Button
                variant='outline'
                onClick={() => void organizations.refetch()}
              >
                Retry
              </Button>
            </p>
          ) : null}
          {organizations.isSuccess ? (
            <>
              <p className='text-sm text-muted-foreground'>
                {filtered.length} of {organizations.data.length} organizations.
                Pagination covers your complete membership list; sorting applies
                to this page only.
              </p>
              <p className='text-sm text-muted-foreground'>
                Select Details to open an organization&apos;s own page. Opening
                a page never changes your active organization.
              </p>
              <MembershipOrganizationsTable
                organizations={pageRows}
                activeOrganizationId={activeOrganizationId}
                caption='Your organizations'
                emptyMessage={
                  organizations.data.length === 0
                    ? 'You do not belong to an organization yet. Create one to get started.'
                    : 'No organizations match this search.'
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
