import { useId, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isAdministrator } from '@/lib/auth'
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
import { usersApi } from '../api'
import { PageControls } from './page-controls'

export function UserPicker({
  value,
  onChange,
  allowAdministrators,
}: {
  value: string
  onChange: (value: string) => void
  allowAdministrators: boolean
}) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const users = useQuery({
    queryKey: ['user-options', search, page],
    queryFn: () => usersApi.list(page, search),
  })
  function find() {
    onChange('')
    setPage(0)
    setSearch(draft)
  }
  return (
    <div className='space-y-2'>
      <Label htmlFor={id}>User</Label>
      <div className='flex gap-2'>
        <Input
          aria-label='Search users'
          placeholder='Name or email'
          maxLength={150}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              find()
            }
          }}
        />
        <Button type='button' variant='outline' onClick={find}>
          Find
        </Button>
      </div>
      {users.isError && (
        <p role='alert'>
          Could not load users.{' '}
          <Button
            type='button'
            variant='link'
            onClick={() => void users.refetch()}
          >
            Retry
          </Button>
        </p>
      )}
      <Select
        value={value}
        onValueChange={onChange}
        disabled={users.isFetching}
      >
        <SelectTrigger id={id}>
          <SelectValue
            placeholder={users.isPending ? 'Loading…' : 'Select user'}
          />
        </SelectTrigger>
        <SelectContent>
          {users.data?.users
            .filter((user) => allowAdministrators || !isAdministrator(user))
            .map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name} ({user.email})
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <PageControls
        page={page}
        loading={users.isFetching}
        hasNext={
          !!users.data && (page + 1) * users.data.limit < users.data.total
        }
        onChange={(next) => {
          onChange('')
          setPage(next)
        }}
      />
    </div>
  )
}
