'use client'

import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'
import { sleep } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'

type UserMultiDeleteDialogProps<TData> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<TData>
}

// Typed confirmation token: the user must enter this exact word.
const CONFIRM_WORD = 'DELETE'

export function UsersMultiDeleteDialog<TData>({
  open,
  onOpenChange,
  table,
}: UserMultiDeleteDialogProps<TData>) {
  const [value, setValue] = useState('')

  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleDelete = () => {
    if (value.trim() !== CONFIRM_WORD) {
      toast.error(
        t('global:users.management.confirmWordError', { word: CONFIRM_WORD })
      )
      return
    }

    onOpenChange(false)

    toast.promise(sleep(2000), {
      loading: t('global:users.management.deleting'),
      success: () => {
        setValue('')
        table.resetRowSelection()
        return t('global:users.management.deleted', {
          count: selectedRows.length,
        })
      },
      error: t('global:shared.error'),
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='users-multi-delete-form'
      disabled={value.trim() !== CONFIRM_WORD}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          {t('global:users.management.deleteSelectedTitle', {
            count: selectedRows.length,
          })}
        </span>
      }
      desc={
        <form
          id='users-multi-delete-form'
          onSubmit={(e) => {
            e.preventDefault()
            handleDelete()
          }}
          className='space-y-4'
        >
          <p className='mb-2'>
            {t('global:users.management.deleteSelectedQuestion')}
          </p>

          <Label className='my-4 flex flex-col items-start gap-1.5'>
            <span className=''>
              {t('global:users.management.confirmByTyping', {
                word: CONFIRM_WORD,
              })}
            </span>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t('global:users.management.typeToConfirm', {
                word: CONFIRM_WORD,
              })}
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
