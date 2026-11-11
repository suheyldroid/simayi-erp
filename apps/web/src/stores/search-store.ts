import { create } from 'zustand'

type SearchState = {
  open: boolean
  setOpen: (open: boolean | ((open: boolean) => boolean)) => void
  toggleSearch: () => void
  resetSearch: () => void
}

export const useSearch = create<SearchState>()((set) => ({
  open: false,
  setOpen: (value) =>
    set((state) => ({
      open: typeof value === 'function' ? value(state.open) : value,
    })),
  toggleSearch: () => set((state) => ({ open: !state.open })),
  resetSearch: () => set({ open: false }),
}))
