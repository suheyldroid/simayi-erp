import { UserPlus } from 'lucide-react'
import { useUsers } from '@/stores/users-store'
import { Button } from '@/components/ui/button'

export function UsersPrimaryButtons() {
  const setOpen = useUsers((state) => state.setOpen)
  return (
    <div className='flex gap-2'>
      <Button className='space-x-1' onClick={() => setOpen('add')}>
        <span>Add User</span> <UserPlus size={18} />
      </Button>
    </div>
  )
}
