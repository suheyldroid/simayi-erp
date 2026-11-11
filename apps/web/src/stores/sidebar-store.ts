import { create } from 'zustand'

/**
 * Ephemeral sidebar runtime state only. The initial open state is the fixed
 * native default (expanded); the user's manual collapse and the mobile sheet
 * toggle live for the current shell mount and are never persisted in a cookie.
 */
const DEFAULT_OPEN = true

type SidebarProviderConfig = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

type SidebarState = {
  state: 'expanded' | 'collapsed'
  open: boolean
  internalOpen: boolean
  controlledOpen: boolean | undefined
  openMobile: boolean
  isMobile: boolean

  setOpen: (open: boolean | ((open: boolean) => boolean)) => void
  setOpenMobile: (open: boolean | ((open: boolean) => boolean)) => void
  setMobile: (isMobile: boolean) => void
  toggleSidebar: () => void

  // Registered by <SidebarProvider> from its props.
  onOpenChange: ((open: boolean) => void) | undefined
  configure: (config: SidebarProviderConfig) => void
  seedDefaultOpen: (defaultOpen: boolean) => void

  resetSidebar: () => void
}

export const useSidebar = create<SidebarState>()((set, get) => ({
  internalOpen: DEFAULT_OPEN,
  controlledOpen: undefined,
  open: DEFAULT_OPEN,
  state: 'expanded',
  openMobile: false,
  isMobile: false,
  onOpenChange: undefined,

  // Mirrors the previous useState/useCallback policy exactly: the next value is
  // computed from the visible open, and a registered onOpenChange suppresses
  // the internal update instead of replacing it.
  setOpen: (value) => {
    const { internalOpen, controlledOpen, onOpenChange } = get()
    const nextOpen =
      typeof value === 'function'
        ? value(controlledOpen ?? internalOpen)
        : value
    if (!onOpenChange) {
      const nextVisibleOpen = controlledOpen ?? nextOpen
      set({
        internalOpen: nextOpen,
        open: nextVisibleOpen,
        state: nextVisibleOpen ? 'expanded' : 'collapsed',
      })
    }
    onOpenChange?.(nextOpen)
  },
  setOpenMobile: (value) => {
    const { openMobile } = get()
    set({
      openMobile: typeof value === 'function' ? value(openMobile) : value,
    })
  },
  setMobile: (isMobile) => {
    if (get().isMobile !== isMobile) set({ isMobile })
  },
  toggleSidebar: () => {
    const { isMobile, setOpen, setOpenMobile } = get()
    if (isMobile) setOpenMobile((openMobile) => !openMobile)
    else setOpen((open) => !open)
  },

  configure: ({ open: controlledOpen, onOpenChange }) => {
    set((state) => {
      const visibleOpen = controlledOpen ?? state.internalOpen
      return {
        controlledOpen,
        onOpenChange,
        open: visibleOpen,
        state: visibleOpen ? 'expanded' : 'collapsed',
      }
    })
  },
  // Only seeds the initial value, matching useState(defaultOpen).
  seedDefaultOpen: (defaultOpen) => {
    set((state) => {
      const visibleOpen = state.controlledOpen ?? defaultOpen
      return {
        internalOpen: defaultOpen,
        open: visibleOpen,
        state: visibleOpen ? 'expanded' : 'collapsed',
      }
    })
  },

  resetSidebar: () => {
    set({
      internalOpen: DEFAULT_OPEN,
      controlledOpen: undefined,
      open: DEFAULT_OPEN,
      state: 'expanded',
      openMobile: false,
      isMobile: false,
      onOpenChange: undefined,
    })
  },
}))
