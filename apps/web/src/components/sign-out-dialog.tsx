import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      const { error } = await authClient.signOut()
      if (error) throw new Error('Sign-out failed')
      queryClient.clear()
      onOpenChange(false)
      await navigate({
        to: '/sign-in',
        search: { redirect: location.href },
        replace: true,
      })
    } catch {
      toast.error('Unable to sign out. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='Sign out'
      desc='Are you sure you want to sign out? You will need to sign in again to access your account.'
      confirmText='Sign out'
      destructive
      isLoading={isLoading}
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
