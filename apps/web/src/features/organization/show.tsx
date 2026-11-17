import { locale, t } from '@/lib/i18n'
import { imageUrl } from '@/lib/image-url'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { organizationLogoPrefix } from './logo-api'
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
  const logo = organization.logo ?? null
  const initials =
    organization.name.trim().slice(0, 2).toLocaleUpperCase(locale) || 'O'
  return (
    <section className='space-y-4'>
      <h3 className='text-xl font-semibold'>
        {t('global:organizationDetails.heading')}
      </h3>
      <div className='flex items-center gap-4'>
        <Avatar className='size-16 rounded-lg'>
          <AvatarImage
            src={logo ? imageUrl(logo) : undefined}
            alt={
              logo
                ? t('global:organizationDetails.logoAlt', {
                    name: organization.name,
                  })
                : ''
            }
            className='object-contain'
            crossOrigin={
              logo?.startsWith(organizationLogoPrefix)
                ? 'use-credentials'
                : undefined
            }
          />
          <AvatarFallback className='rounded-lg'>{initials}</AvatarFallback>
        </Avatar>
        <div className='space-y-1'>
          <p className='text-sm font-medium'>
            {t('global:organizationDetails.logoLabel')}
          </p>
          <p className='text-sm text-muted-foreground'>
            {logo
              ? t('global:organizationDetails.logoPresent')
              : t('global:organizationDetails.logoMissing')}
          </p>
        </div>
      </div>
      <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
        <dt>{t('global:organizationDetails.name')}</dt>
        <dd>{organization.name}</dd>
        <dt>{t('global:organizationDetails.slug')}</dt>
        <dd className='break-all'>{organization.slug}</dd>
      </dl>
    </section>
  )
}
