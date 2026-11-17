import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'
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
        queryClient.invalidateQueries({ queryKey: ['user-options'] }),
        queryClient.invalidateQueries({ queryKey: ['user', user.id] }),
      ])
      onClose()
      toast.success(
        deactivating
          ? t('global:users.statusDialog.deactivated')
          : t('global:users.statusDialog.activated')
      )
    } catch {
      toast.error(t('global:users.statusDialog.failed'))
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
      title={
        deactivating
          ? t('global:users.statusDialog.deactivateTitle')
          : t('global:users.statusDialog.activateTitle')
      }
      desc={
        deactivating
          ? t('global:users.statusDialog.deactivateDescription', {
              email: user?.email ?? '',
            })
          : t('global:users.statusDialog.activateDescription', {
              email: user?.email ?? '',
            })
      }
      confirmText={
        deactivating
          ? t('global:users.statusDialog.deactivate')
          : t('global:users.statusDialog.activate')
      }
      destructive={deactivating}
      isLoading={saving}
      handleConfirm={confirm}
    />
  )
}
