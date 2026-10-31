import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAdministrator } from '@/lib/auth'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { hasPermission, type EffectivePermissions } from '../access-model'
import { usersApi } from '../api'
import type { User } from '../model'
import { ErpProfilePanel } from './erp-profile-panel'

function AccountProfileForm({
  user,
  canEdit,
  onSaved,
}: {
  user: User
  canEdit: boolean
  onSaved: () => void
}) {
  const client = useQueryClient()
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
        client.invalidateQueries({ queryKey: ['users'] }),
        client.invalidateQueries({ queryKey: ['user-options'] }),
        client.invalidateQueries({ queryKey: ['user', user.id] }),
        client.invalidateQueries({ queryKey: ['session'] }),
      ])
      onSaved()
      toast.success('Account profile updated.')
    } catch {
      form.setError('root', {
        message:
          'Could not update the account profile. Check values and platform administrator access.',
      })
    }
  }
  return (
    <form onSubmit={form.handleSubmit(submit)}>
      <fieldset
        disabled={!canEdit || form.formState.isSubmitting}
        className='space-y-4'
      >
        <dl className='grid grid-cols-[auto_1fr] gap-2 text-sm'>
          <dt>Email</dt>
          <dd className='break-all'>{user.email}</dd>
          <dt>Role</dt>
          <dd>{user.role}</dd>
          <dt>Status</dt>
          <dd>{user.isActive && !user.banned ? 'Active' : 'Inactive'}</dd>
          <dt>Created</dt>
          <dd>{new Date(user.createdAt).toLocaleString()}</dd>
        </dl>
        {!canEdit && (
          <p className='text-sm text-muted-foreground'>
            Native account fields are read-only for delegates.
          </p>
        )}
        <div className='space-y-2'>
          <Label htmlFor='account-profile-name'>Name</Label>
          <Input
            id='account-profile-name'
            required
            maxLength={150}
            {...form.register('name', {
              required: true,
              validate: (value) => !!value.trim(),
            })}
          />
          {form.formState.errors.name && <p role='alert'>Enter a name.</p>}
        </div>
        <div className='space-y-2'>
          <Label htmlFor='account-profile-image'>Avatar URL</Label>
          <Input
            id='account-profile-image'
            type='url'
            maxLength={2048}
            {...form.register('image')}
          />
        </div>
        {form.formState.errors.root && (
          <p role='alert' className='text-destructive'>
            {form.formState.errors.root.message}
          </p>
        )}
        <Button disabled={!canEdit || form.formState.isSubmitting}>
          Save account profile
        </Button>
      </fieldset>
    </form>
  )
}

export function UserProfileDialog({
  userId,
  actorId,
  effective,
  onClose,
}: {
  userId: string | null
  actorId: string
  effective: EffectivePermissions
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
  const canEdit =
    details.data &&
    (details.data.id === actorId ||
      (hasPermission(effective, 'admin', 'change') &&
        (effective.isAdministrator || !isAdministrator(details.data))))
  return (
    <Dialog
      open={userId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>User profile and details</DialogTitle>
          <DialogDescription>
            ERP profile permissions are separate from native account
            administration.
          </DialogDescription>
        </DialogHeader>
        {details.isPending && <p role='status'>Loading user…</p>}
        {details.isError && (
          <p role='alert'>
            Could not load user.{' '}
            <Button variant='outline' onClick={() => void details.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {details.data && !details.isError && (
          <Tabs key={details.data.id} defaultValue='erp'>
            <TabsList>
              <TabsTrigger value='erp'>ERP profile</TabsTrigger>
              <TabsTrigger value='account'>Account</TabsTrigger>
            </TabsList>
            <TabsContent value='erp'>
              <ErpProfilePanel userId={details.data.id} canEdit={!!canEdit} />
            </TabsContent>
            <TabsContent value='account'>
              <AccountProfileForm
                user={details.data}
                canEdit={effective.isAdministrator}
                onSaved={onClose}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
