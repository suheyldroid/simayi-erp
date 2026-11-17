'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { locale, t } from '@/lib/i18n'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type User } from '../data/schema'

type UserDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: User
}

export function UsersDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: UserDeleteDialogProps) {
  const [value, setValue] = useState('')

  const handleDelete = () => {
    if (value.trim() !== currentRow.username) return

    onOpenChange(false)
    showSubmittedData(currentRow, t('global:users.management.deletedNotice'))
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='users-delete-form'
      disabled={value.trim() !== currentRow.username}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          {t('global:users.management.deleteUserTitle')}
        </span>
      }
      desc={
        <form
          id='users-delete-form'
          onSubmit={(e) => {
            e.preventDefault()
            handleDelete()
          }}
          className='space-y-4'
        >
          <p className='mb-2'>
            {t('global:users.management.deleteQuestion', {
              username: currentRow.username,
              role: currentRow.role.toLocaleUpperCase(locale),
            })}
          </p>

          <Label className='my-2'>
            {t('global:users.management.usernameLabel')}
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('global:users.management.deletePlaceholder')}
              autoFocus
            />
          </Label>

          <Alert variant='destructive'>
            <AlertTitle>{t('global:users.management.warningTitle')}</AlertTitle>
            <AlertDescription>
              {t('global:users.management.warningBody')}
            </AlertDescription>
          </Alert>
        </form>
      }
      confirmText={t('global:users.management.delete')}
      destructive
    />
  )
}
