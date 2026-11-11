import { useOrganizationSettingsAccess } from './settings-access'
import { OrganizationSettingsPage } from './settings-page'

/**
 * Organization details. The verified slug boundary and the shared settings gate
 * above always supply the organization id, never a route id param.
 */
export function OrganizationDetails() {
  return (
    <OrganizationSettingsPage>
      <DetailsContent />
    </OrganizationSettingsPage>
  )
}

function DetailsContent() {
  const { organization } = useOrganizationSettingsAccess()
  return (
    <section className='space-y-4'>
      <h3 className='text-xl font-semibold'>Organization details</h3>
      <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
        <dt>Name</dt>
        <dd>{organization.name}</dd>
        <dt>Slug</dt>
        <dd className='break-all'>{organization.slug}</dd>
      </dl>
    </section>
  )
}
