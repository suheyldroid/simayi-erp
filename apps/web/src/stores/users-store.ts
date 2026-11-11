import { type SetStateAction } from 'react'
import { create } from 'zustand'
import { type User } from '@/features/users/data/schema'

type UsersDialogType = 'add' | 'edit' | 'delete'

type UsersState = {
  open: UsersDialogType | null
  currentRow: User | null
  setOpen: (dialog: UsersDialogType | null) => void
  setCurrentRow: (value: SetStateAction<User | null>) => void
  resetUsers: () => void
}

export const useUsers = create<UsersState>()((set) => ({
  open: null,
  currentRow: null,

  // Selecting the already open dialog closes it, mirroring useDialogState.
  setOpen: (dialog) =>
    set((state) => ({ open: state.open === dialog ? null : dialog })),
  setCurrentRow: (value) =>
    set((state) => ({
      currentRow: typeof value === 'function' ? value(state.currentRow) : value,
    })),

  // Dialog and row state are ephemeral: they must not outlive the users view.
  resetUsers: () => set({ open: null, currentRow: null }),
}))
