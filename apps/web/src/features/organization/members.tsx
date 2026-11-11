import { MembersPanel } from './members-panel'
import { useOrganizationSettingsAccess } from './settings-access'
import { OrganizationSettingsPage } from './settings-page'

/**
 * Organization members page. Native owner/admin capabilities come from the
 * shared settings gate; the server still enforces every native member rule.
 */
export function OrganizationMembers() {
  return (
    <OrganizationSettingsPage>
      <MembersContent />
    </OrganizationSettingsPage>
  )
}

function MembersContent() {
  const { organizationId, actorRoles, canManage } =
    useOrganizationSettingsAccess()
  return (
    <section className='space-y-4'>
      <h3 className='text-xl font-semibold'>Members</h3>
      <MembersPanel
        organizationId={organizationId}
        actorRoles={actorRoles}
        canCreate={canManage}
        canUpdate={canManage}
        canDelete={canManage}
      />
    </section>
  )
}
