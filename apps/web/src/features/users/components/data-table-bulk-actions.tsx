import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Trash2, UserX, UserCheck, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { t } from '@/lib/i18n'
import { sleep } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { type User } from '../data/schema'
import { UsersMultiDeleteDialog } from './users-multi-delete-dialog'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleBulkStatusChange = (status: 'active' | 'inactive') => {
    const selectedUsers = selectedRows.map((row) => row.original as User)
    const activating = status === 'active'
    toast.promise(sleep(2000), {
      loading: activating
        ? t('global:users.management.activating')
        : t('global:users.management.deactivating'),
      success: () => {
        table.resetRowSelection()
        return activating
          ? t('global:users.management.activated', {
              count: selectedUsers.length,
            })
          : t('global:users.management.deactivated', {
              count: selectedUsers.length,
            })
      },
      error: activating
        ? t('global:users.management.activateFailed')
        : t('global:users.management.deactivateFailed'),
    })
    table.resetRowSelection()
  }

  const handleBulkInvite = () => {
    const selectedUsers = selectedRows.map((row) => row.original as User)
    toast.promise(sleep(2000), {
      loading: t('global:users.management.inviting'),
      success: () => {
        table.resetRowSelection()
        return t('global:users.management.invited', {
          count: selectedUsers.length,
        })
      },
      error: t('global:users.management.inviteFailed'),
    })
    table.resetRowSelection()
  }

  return (
    <>
      <BulkActionsToolbar
        table={table}
        entityName={t('global:users.management.entityName')}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={handleBulkInvite}
              className='size-8'
              aria-label={t('global:users.management.inviteSelected')}
              title={t('global:users.management.inviteSelected')}
            >
              <Mail />
              <span className='sr-only'>
                {t('global:users.management.inviteSelected')}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('global:users.management.inviteSelected')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => handleBulkStatusChange('active')}
              className='size-8'
              aria-label={t('global:users.management.activateSelected')}
              title={t('global:users.management.activateSelected')}
            >
              <UserCheck />
              <span className='sr-only'>
                {t('global:users.management.activateSelected')}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('global:users.management.activateSelected')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => handleBulkStatusChange('inactive')}
              className='size-8'
              aria-label={t('global:users.management.deactivateSelected')}
              title={t('global:users.management.deactivateSelected')}
            >
              <UserX />
              <span className='sr-only'>
                {t('global:users.management.deactivateSelected')}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('global:users.management.deactivateSelected')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              className='size-8'
              aria-label={t('global:users.management.deleteSelected')}
              title={t('global:users.management.deleteSelected')}
            >
              <Trash2 />
              <span className='sr-only'>
                {t('global:users.management.deleteSelected')}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('global:users.management.deleteSelected')}</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <UsersMultiDeleteDialog
        table={table}
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      />
    </>
  )
}
