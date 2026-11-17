import { UserPlus } from 'lucide-react'
import { useUsers } from '@/stores/users-store'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

export function UsersPrimaryButtons() {
  const setOpen = useUsers((state) => state.setOpen)
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>{t('global:users.management.addUser')}</span>{' '}
        <UserPlus size={18} />
      </Button>
    </div>
  )
}
