import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { organizationCacheScope } from '@/lib/tenant'
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
import { errorMessage, salesChannelApi } from '../api'
import type { SalesChannel } from '../model'

export function ChannelSelect({
  value,
  disabled = false,
  onChange,
}: {
  value: SalesChannel | null
  disabled?: boolean
  onChange: (next: SalesChannel | null) => void
}) {
  const labelId = useId()
  const newNameId = useId()
  const client = useQueryClient()
  const [newName, setNewName] = useState('')
  const scope = organizationCacheScope()
  const channels = useQuery({
    queryKey: ['sales', scope, 'channels', 'list'],
    queryFn: () => salesChannelApi.list(),
  })
  const creation = useMutation({
    mutationFn: (name: string) => salesChannelApi.create(name),
    onSuccess: async (channel) => {
      setNewName('')
      onChange(channel)
      await client.invalidateQueries({
        queryKey: ['sales', scope, 'channels'],
      })
    },
  })
  const items = (channels.data?.items ?? []).filter(
    (channel) => channel.active || channel.uuid === value?.uuid
  )
  return (
    <div className='space-y-2'>
      <Label id={labelId}>Sales channel</Label>
      <Select
        value={value?.uuid}
        disabled={disabled || channels.isPending}
        onValueChange={(uuid) => {
          onChange(items.find((channel) => channel.uuid === uuid) ?? null)
        }}
      >
        <SelectTrigger aria-labelledby={labelId} className='w-full'>
          <SelectValue placeholder='Choose a channel' />
        </SelectTrigger>
        <SelectContent>
          {items.map((channel) => (
            <SelectItem key={channel.uuid} value={channel.uuid}>
              {channel.name}
              {channel.active ? '' : ' (inactive)'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {channels.isError && (
        <p role='alert' className='text-sm text-destructive'>
          {errorMessage(channels.error)}{' '}
          <Button
            type='button'
            variant='outline'
            onClick={() => void channels.refetch()}
          >
            Retry
          </Button>
        </p>
      )}
      {channels.data && channels.data.total > items.length && (
        <p className='text-xs text-muted-foreground'>
          Showing {items.length} of {channels.data.total} channels.
        </p>
      )}
      <div className='flex items-end gap-2'>
        <div className='min-w-0 flex-1 space-y-1'>
          <Label htmlFor={newNameId} className='text-xs'>
            New channel
          </Label>
          <Input
            id={newNameId}
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder='Channel name'
            maxLength={100}
            disabled={disabled || creation.isPending}
          />
        </div>
        <Button
          type='button'
          variant='outline'
          disabled={disabled || creation.isPending || newName.trim() === ''}
          onClick={() => creation.mutate(newName.trim())}
        >
          Add channel
        </Button>
      </div>
      {creation.isError && (
        <p role='alert' className='text-sm text-destructive'>
          {errorMessage(creation.error)}
        </p>
      )}
    </div>
  )
}
