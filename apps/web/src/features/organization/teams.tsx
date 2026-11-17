import { t } from '@/lib/i18n'
import { useOrganizationSettingsAccess } from './settings-access'
import { OrganizationSettingsPage } from './settings-page'
import { TeamsPanel } from './teams-panel'

/**
 * Organization teams page. Native owner/admin capabilities come from the
 * shared settings gate; the server still enforces every native team rule.
 */
export function OrganizationTeams() {
  return (
    <OrganizationSettingsPage>
      <TeamsContent />
    </OrganizationSettingsPage>
  )
}

function TeamsContent() {
  const { organizationId, activeTeamId, currentUserId, canManage } =
    useOrganizationSettingsAccess()
  return (
    <section className='space-y-4'>
      <h3 className='text-xl font-semibold'>
        {t('global:organizationTeams.heading')}
      </h3>
      <TeamsPanel
        organizationId={organizationId}
        activeTeamId={activeTeamId}
        currentUserId={currentUserId}
        canCreate={canManage}
        canUpdate={canManage}
        canDelete={canManage}
        canAddMember={canManage}
        canRemoveMember={canManage}
      />
    </section>
  )
}
