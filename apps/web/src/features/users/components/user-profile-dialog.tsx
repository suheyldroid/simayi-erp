import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usersApi } from '../api'
import type { User } from '../model'

function ProfileForm({ user, onSaved }: { user: User; onSaved: () => void }) {
  const queryClient = useQueryClient()
  const form = useForm({
    defaultValues: { name: user.name, image: user.image ?? '' },
  })

  async function submit(input: { name: string; image: string }) {
    try {
      await usersApi.updateProfile(user.id, {
        name: input.name.trim(),
        image: input.image.trim() || null,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['user', user.id] }),
        queryClient.invalidateQueries({ queryKey: ['session'] }),
      ])
      onSaved()
      toast.success('Profile updated.')
    } catch {
      form.setError('root', {
        message:
          'Could not update the profile. Check the values and your connection.',
      })
    }
  }

  return (
    <form className='space-y-4' onSubmit={form.handleSubmit(submit)}>
      <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm'>
        <dt className='text-muted-foreground'>Email</dt>
        <dd className='break-all'>{user.email}</dd>
        <dt className='text-muted-foreground'>Role</dt>
        <dd>{user.role}</dd>
        <dt className='text-muted-foreground'>Status</dt>
        <dd>{user.isActive && !user.banned ? 'Active' : 'Inactive'}</dd>
        <dt className='text-muted-foreground'>Created</dt>
        <dd>{new Date(user.createdAt).toLocaleString()}</dd>
        <dt className='text-muted-foreground'>Updated</dt>
        <dd>{new Date(user.updatedAt).toLocaleString()}</dd>
      </dl>
      <div className='space-y-2'>
        <Label htmlFor='profile-name'>Name</Label>
        <Input
          id='profile-name'
          required
          maxLength={150}
          {...form.register('name', {
            required: true,
            validate: (value) => value.trim().length > 0,
          })}
        />
        {form.formState.errors.name && <p role='alert'>Enter a name.</p>}
      </div>
      <div className='space-y-2'>
        <Label htmlFor='profile-image'>Avatar URL</Label>
        <Input
          id='profile-image'
          type='url'
          maxLength={2048}
          placeholder='https://example.com/avatar.png'
          {...form.register('image')}
        />
        <p className='text-sm text-muted-foreground'>
          Use an HTTP or HTTPS URL. Leave empty to remove the image.
        </p>
      </div>
      {form.formState.errors.root && (
        <p role='alert' className='text-sm text-destructive'>
          {form.formState.errors.root.message}
        </p>
      )}
      <Button disabled={form.formState.isSubmitting}>Save profile</Button>
    </form>
  )
}

export function UserProfileDialog({
  userId,
  onClose,
}: {
  userId: string | null
  onClose: () => void
}) {
  const details = useQuery({
    queryKey: ['user', userId],
    queryFn: () => {
      if (!userId) throw new Error('User ID is required')
      return usersApi.get(userId)
    },
    enabled: userId !== null,
    refetchOnWindowFocus: false,
  })

  return (
    <Dialog
      open={userId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>User details</DialogTitle>
          <DialogDescription>
            View account details and edit the profile. Email, password, and
            roles remain managed by Better Auth.
          </DialogDescription>
        </DialogHeader>
        {details.isPending && <p role='status'>Loading user…</p>}
        {details.isError && (
          <div role='alert'>
            Unable to load user.{' '}
            <Button variant='outline' onClick={() => void details.refetch()}>
              Retry
            </Button>
          </div>
        )}
        {details.data && !details.isError && (
          <ProfileForm
            key={details.data.id}
            user={details.data}
            onSaved={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
