import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { usersApi } from '../api'
import type { User } from '../model'

export function UserStatusDialog({
  user,
  onClose,
}: {
  user: User | null
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()
  const deactivating = user?.isActive === true && !user.banned

  async function confirm() {
    if (!user) return
    setSaving(true)
    try {
      await usersApi.setActive(user.id, !deactivating)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['user', user.id] }),
      ])
      onClose()
      toast.success(
        deactivating
          ? 'User deactivated. All sessions revoked.'
          : 'User activated.'
      )
    } catch {
      toast.error(
        'Could not change user status. Administrator accounts cannot be deactivated here.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <ConfirmDialog
      open={user !== null}
      onOpenChange={(open) => {
        if (!open && !saving) onClose()
      }}
      title={deactivating ? 'Deactivate user' : 'Activate user'}
      desc={
        deactivating
          ? `Deactivate ${user?.email ?? ''}? All sessions will end and sign-in will be blocked.`
          : `Allow ${user?.email ?? ''} to sign in again?`
      }
      confirmText={deactivating ? 'Deactivate' : 'Activate'}
      destructive={deactivating}
      isLoading={saving}
      handleConfirm={confirm}
    />
  )
}
