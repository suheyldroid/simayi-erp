import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { sessionQuery } from '@/lib/auth'
import { locale, t } from '@/lib/i18n'
import { imageUrl } from '@/lib/image-url'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { avatarReferencePrefix } from '@/features/settings/profile/avatar-api'

/**
 * Header account menu. It is the only entry point to account settings now that
 * the sidebars carry no Settings link, so there is exactly one entry pointing at
 * `/settings` (the native account profile lives there). The template's Billing
 * and New Team rows are gone: the backend has no billing or global team surface,
 * so neither is invented here.
 */
export function ProfileDropdown() {
  const [open, setOpen] = useDialogState()
  const { data: session } = useQuery(sessionQuery)
  const user = session?.user

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className='relative h-8 w-8 rounded-full'
            aria-label={t('common:a11y.accountMenu')}
          >
            <Avatar className='h-8 w-8'>
              <AvatarImage
                src={user?.image ? imageUrl(user.image) : undefined}
                alt={user?.name ?? ''}
                crossOrigin={
                  user?.image?.startsWith(avatarReferencePrefix)
                    ? 'use-credentials'
                    : undefined
                }
              />
              <AvatarFallback>
                {user?.name.slice(0, 2).toLocaleUpperCase(locale) ?? 'U'}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end' forceMount>
          <DropdownMenuLabel className='font-normal'>
            <div className='flex flex-col gap-1.5'>
              <p className='text-sm leading-none font-medium'>{user?.name}</p>
              <p className='text-xs leading-none text-muted-foreground'>
                {user?.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link to='/settings'>{t('common:account.settings')}</Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant='destructive' onClick={() => setOpen(true)}>
            {t('common:account.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
