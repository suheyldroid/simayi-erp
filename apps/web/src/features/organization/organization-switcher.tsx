import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { organizationSessionQuery } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  organizationApi,
  organizationErrorMessage,
  organizationPath,
} from './api'
import { useOrganizationMemberships } from './membership-query'

/**
 * Organization-boundary switcher. It only ever activates a native membership
 * and lands on that organization's canonical slug page.
 */
export function OrganizationSwitcher() {
  const session = useQuery(organizationSessionQuery)
  const activeOrganizationId =
    session.data?.session.activeOrganizationId ?? null
  const organizations = useOrganizationMemberships()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const memberships = organizations.isSuccess ? organizations.data : []

  async function select(next: string) {
    if (next === activeOrganizationId) return
    const organization = memberships.find((item) => item.id === next)
    if (!organization) return
    setPending(true)
    setError('')
    try {
      await organizationApi.enter(
        organization.id,
        organizationPath(organization.slug)
      )
    } catch (caught) {
      setPending(false)
      setError(organizationErrorMessage(caught))
    }
  }

  if (
    organizations.isSuccess &&
    organizations.data.length === 0 &&
    !activeOrganizationId
  )
    return null

  return (
    <div className='space-y-2 px-2'>
      <Label htmlFor='active-organization' className='sr-only'>
        Organization
      </Label>
      {organizations.isPending ? (
        <p role='status'>Loading organizations…</p>
      ) : null}
      {organizations.isError ? (
        <p role='alert'>
          Could not load organizations.{' '}
          <Button
            type='button'
            variant='link'
            onClick={() => void organizations.refetch()}
          >
            Retry
          </Button>
        </p>
      ) : null}
      {organizations.isSuccess ? (
        <Select
          value={activeOrganizationId ?? undefined}
          disabled={pending}
          onValueChange={(value) => void select(value)}
        >
          <SelectTrigger id='active-organization' className='w-full'>
            <SelectValue placeholder='Select organization' />
          </SelectTrigger>
          <SelectContent>
            {memberships.map((organization) => (
              <SelectItem key={organization.id} value={organization.id}>
                {organization.name || organization.slug || organization.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {pending ? <p role='status'>Switching organization…</p> : null}
      {error ? <p role='alert'>{error}</p> : null}
    </div>
  )
}
