import { useCallback, useLayoutEffect, useRef } from 'react'
import { useSearch } from '@/stores/search-store'
import { useSidebar } from '@/stores/sidebar-store'
import { useUsers } from '@/stores/users-store'

function useResetShellState() {
  const resetSearch = useSearch((state) => state.resetSearch)
  const setOpenMobile = useSidebar((state) => state.setOpenMobile)
  const resetUsers = useUsers((state) => state.resetUsers)
  return useCallback(() => {
    resetSearch()
    setOpenMobile(false)
    resetUsers()
  }, [resetSearch, setOpenMobile, resetUsers])
}

/**
 * Ephemeral authenticated UI state (command menu, mobile sidebar, users dialog)
 * must not survive a session or organization boundary. Scope changes and shell
 * exits reset it before paint so the previous scope is never shown inside the
 * next one. The fixed shell layout and controlled sidebar props are untouched.
 */
export function useShellReset(scope: string | null) {
  const resetShellState = useResetShellState()
  const previousScope = useRef(scope)

  useLayoutEffect(() => {
    if (previousScope.current === scope) return
    previousScope.current = scope
    resetShellState()
  }, [scope, resetShellState])

  useLayoutEffect(() => () => resetShellState(), [resetShellState])
}
