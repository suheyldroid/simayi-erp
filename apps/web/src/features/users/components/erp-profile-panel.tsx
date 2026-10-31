import { useForm, useWatch } from 'react-hook-form'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { accessApi } from '../access-api'
import {
  AccessModel,
  profileTextFields,
  type ErpProfile,
  type ErpProfileInput,
  type ProfileFormValues,
} from '../access-model'

function ErpProfileForm({
  profile,
  canEdit,
}: {
  profile: ErpProfile
  canEdit: boolean
}) {
  const client = useQueryClient()
  const form = useForm<ProfileFormValues>({
    defaultValues: {
      displayname: profile.displayname ?? '',
      position: profile.position ?? '',
      language: profile.language ?? '',
      contact: profile.contact ?? '',
      organisation: profile.organisation ?? '',
      location: profile.location ?? '',
      status: profile.status ?? '',
      active: profile.active,
      type: profile.type,
      primaryGroupId: profile.primaryGroupId?.toString() ?? '',
    },
  })
  const [userType, primaryGroupId, active] = useWatch({
    control: form.control,
    name: ['type', 'primaryGroupId', 'active'],
  })
  const groups = useInfiniteQuery({
    queryKey: ['user-groups', profile.userId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      accessApi.memberships(profile.userId, pageParam),
    getNextPageParam: (page) =>
      page.offset + page.groups.length < page.total
        ? page.offset + page.limit
        : undefined,
  })
  const options = groups.data?.pages.flatMap((page) => page.groups) ?? []
  async function save(values: ProfileFormValues) {
    const body: ErpProfileInput = {
      active: values.active,
      type: values.type,
      primaryGroupId: values.primaryGroupId
        ? Number(values.primaryGroupId)
        : null,
    }
    for (const field of profileTextFields)
      body[field.name] = values[field.name].trim() || null
    try {
      await accessApi.updateProfile(profile.userId, body)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['erp-profile', profile.userId] }),
        client.invalidateQueries({ queryKey: ['owners'] }),
      ])
      toast.success('ERP profile saved.')
    } catch {
      form.setError('root', {
        message:
          'Could not save. Check membership and permissions, then reload and retry.',
      })
    }
  }
  return (
    <form className='space-y-4' onSubmit={form.handleSubmit(save)}>
      {!canEdit && (
        <p className='text-sm text-muted-foreground'>Read-only profile.</p>
      )}
      <fieldset
        disabled={!canEdit || form.formState.isSubmitting}
        className='grid gap-4 sm:grid-cols-2'
      >
        {profileTextFields.map((field) => (
          <div className='space-y-2' key={field.name}>
            <Label htmlFor={`erp-${profile.userId}-${field.name}`}>
              {field.label}
            </Label>
            <Input
              id={`erp-${profile.userId}-${field.name}`}
              maxLength={field.maxLength}
              {...form.register(field.name)}
            />
          </div>
        ))}
        <div className='space-y-2'>
          <Label htmlFor={`erp-type-${profile.userId}`}>User type</Label>
          <Select
            value={userType}
            onValueChange={(value) => {
              const parsed = AccessModel.profile.shape.type.safeParse(value)
              if (parsed.success) form.setValue('type', parsed.data)
            }}
            disabled={!canEdit}
          >
            <SelectTrigger id={`erp-type-${profile.userId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['internal', 'external', 'guest', 'bot'].map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-2'>
          <Label htmlFor={`erp-group-${profile.userId}`}>Primary group</Label>
          <Select
            value={primaryGroupId || 'none'}
            onValueChange={(value) =>
              form.setValue('primaryGroupId', value === 'none' ? '' : value)
            }
            disabled={!canEdit || groups.isPending}
          >
            <SelectTrigger id={`erp-group-${profile.userId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='none'>None</SelectItem>
              {profile.primaryGroup &&
                !options.some(
                  (group) => group.id === profile.primaryGroupId
                ) && (
                  <SelectItem value={profile.primaryGroup.id.toString()}>
                    {profile.primaryGroup.name}
                  </SelectItem>
                )}
              {options.map((group) => (
                <SelectItem key={group.id} value={group.id.toString()}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {groups.hasNextPage && (
            <Button
              type='button'
              variant='link'
              disabled={groups.isFetchingNextPage}
              onClick={() => void groups.fetchNextPage()}
            >
              Load more groups
            </Button>
          )}
          {groups.isError && (
            <p role='alert'>
              Could not load memberships.{' '}
              <Button
                type='button'
                variant='link'
                onClick={() => void groups.refetch()}
              >
                Retry
              </Button>
            </p>
          )}
        </div>
        <div className='flex items-center gap-3'>
          <Switch
            id={`erp-active-${profile.userId}`}
            checked={active}
            onCheckedChange={(active) => form.setValue('active', active)}
            disabled={!canEdit}
          />
          <Label htmlFor={`erp-active-${profile.userId}`}>Profile active</Label>
        </div>
      </fieldset>
      <p className='text-sm text-muted-foreground'>
        Profile activity and user type do not grant permissions or change
        account sign-in status.
      </p>
      {form.formState.errors.root && (
        <p role='alert' className='text-destructive'>
          {form.formState.errors.root.message}
        </p>
      )}
      {canEdit && (
        <Button disabled={form.formState.isSubmitting}>Save ERP profile</Button>
      )}
    </form>
  )
}

export function ErpProfilePanel({
  userId,
  canEdit = true,
}: {
  userId: string
  canEdit?: boolean
}) {
  const profile = useQuery({
    queryKey: ['erp-profile', userId],
    queryFn: () => accessApi.profile(userId),
    refetchOnWindowFocus: false,
  })
  if (profile.isPending) return <p role='status'>Loading profile…</p>
  if (profile.isError)
    return (
      <p role='alert'>
        Could not load profile.{' '}
        <Button variant='outline' onClick={() => void profile.refetch()}>
          Retry
        </Button>
      </p>
    )
  return (
    <ErpProfileForm
      key={profile.data.id}
      profile={profile.data}
      canEdit={canEdit}
    />
  )
}
