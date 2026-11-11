import { useEffect } from 'react'
import { useUsers } from '@/stores/users-store'
import { UsersActionDialog } from './users-action-dialog'
import { UsersDeleteDialog } from './users-delete-dialog'

const CURRENT_ROW_RESET_DELAY = 500

export function UsersDialogs() {
  const open = useUsers((state) => state.open)
  const setOpen = useUsers((state) => state.setOpen)
  const currentRow = useUsers((state) => state.currentRow)
  const setCurrentRow = useUsers((state) => state.setCurrentRow)
  const resetUsers = useUsers((state) => state.resetUsers)

  // The row only outlives the dialog for the close animation. Any open or row
  // transition cancels the pending reset, so a stale timer can never clear the
  // row of a dialog that was reopened in the meantime. The callback re-checks
  // the latest store state because passive cleanup can lag a queued timer.
  useEffect(() => {
    if (open !== null || currentRow === null) return
    const currentRowResetTimeout = window.setTimeout(() => {
      const state = useUsers.getState()
      if (state.open === null && state.currentRow === currentRow) {
        setCurrentRow(null)
      }
    }, CURRENT_ROW_RESET_DELAY)
    return () => window.clearTimeout(currentRowResetTimeout)
  }, [currentRow, open, setCurrentRow])

  // Neither a pending reset nor the selected row may survive this view: it is
  // remounted on organization switches and on sign-in.
  useEffect(() => () => resetUsers(), [resetUsers])

  return (
    <>
      <UsersActionDialog
        key='user-add'
        open={open === 'add'}
        onOpenChange={() => setOpen('add')}
      />

      {currentRow && (
        <>
          <UsersActionDialog
            key={`user-edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={() => setOpen('edit')}
            currentRow={currentRow}
          />

          <UsersDeleteDialog
            key={`user-delete-${currentRow.id}`}
            open={open === 'delete'}
            onOpenChange={() => setOpen('delete')}
            currentRow={currentRow}
          />
        </>
      )}
    </>
  )
}
