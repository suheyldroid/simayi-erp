import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'

/**
 * Organization workspace overview. The body is intentionally empty: the shell
 * already carries the switcher, business navigation and account menu, so this
 * page only keeps the shared header controls and an empty main landmark for
 * later work. `id='content'` gives the shell skip link a real target.
 */
export function OrganizationDashboard() {
  return (
    <>
      <Header fixed>
        <div className='ms-auto'>
          <ProfileDropdown />
        </div>
      </Header>
      <Main id='content' />
    </>
  )
}
