import { Outlet } from '@tanstack/react-router'
import { t } from '@/lib/i18n'
import { Separator } from '@/components/ui/separator'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { SettingsNav } from './components/sidebar-nav'

/**
 * Shared settings frame for personal, platform and organization settings. It
 * owns the one page heading and the categorized inner navigation; route pages
 * render through the outlet. The navigation derives its organization/company
 * or branch scope from the verified path, so the same frame serves
 * `/o/<slug>/settings` and `/o/<slug>/b/<uuid>/settings` without a company
 * chooser in branch scope. The outer `_system` shell owns the global sidebar
 * and its provider.
 */
export function Settings({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ProfileDropdown />
      </Header>

      <Main fixed>
        <div className='space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            {t('global:settings.frame.title')}
          </h1>
          <p className='text-muted-foreground'>
            {t('global:settings.frame.description')}
          </p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex flex-1 flex-col gap-6 overflow-hidden lg:flex-row lg:gap-12'>
          <aside className='shrink-0 lg:sticky lg:top-20 lg:w-1/5 lg:self-start'>
            <div className='max-h-[45svh] overflow-y-auto pe-1 lg:max-h-[calc(100svh-16rem)]'>
              <SettingsNav />
            </div>
          </aside>
          <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-1'>
            {children ?? <Outlet />}
          </div>
        </div>
      </Main>
    </>
  )
}
