import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { accessApi, refreshAccess } from '../access-api'
import {
  hasPermission,
  type EffectivePermissions,
  type PermissionAction,
} from '../access-model'
import { PageControls } from './page-controls'
import { UserPicker } from './user-picker'

export function OwnersPanel({
  effective,
}: {
  effective: EffectivePermissions
}) {
  const [page, setPage] = useState(0)
  const [userId, setUserId] = useState('')
  const [ownerId, setOwnerId] = useState<number | null>(null)
  const [scope, setScope] = useState('stock')
  const [action, setAction] = useState<PermissionAction>('view')
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const client = useQueryClient()
  const owners = useQuery({
    queryKey: ['owners', page],
    queryFn: () => accessApi.owners(page),
  })
  async function create() {
    if (!userId) return
    setSaving(true)
    try {
      await accessApi.createOwner({ kind: 'user', userId })
      setUserId('')
      await refreshAccess(client)
      toast.success('User owner resolved.')
    } catch {
      toast.error('Could not resolve owner. Check permissions and reload.')
    } finally {
      setSaving(false)
    }
  }
  async function inspect() {
    if (ownerId === null) return
    setSaving(true)
    setAllowed(null)
    try {
      setAllowed((await accessApi.check(scope, action, ownerId)).allowed)
    } catch {
      toast.error('Could not read the access decision.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className='space-y-4'>
      <p className='text-sm text-muted-foreground'>
        Ownership never grants permission by itself. Access requires the
        matching RuleSet permission and user/group ownership. Non-managers see
        only matching owners.
      </p>
      {hasPermission(effective, 'admin', 'add') && (
        <div className='max-w-xl space-y-3 rounded-md border p-4'>
          <h2 className='font-semibold'>Resolve user owner</h2>
          <UserPicker
            value={userId}
            onChange={setUserId}
            allowAdministrators={effective.isAdministrator}
          />
          <Button disabled={!userId || saving} onClick={() => void create()}>
            Resolve owner
          </Button>
          <p className='text-sm text-muted-foreground'>
            Group owners are created with their groups. Existing owners are
            reused, never retargeted.
          </p>
        </div>
      )}
      {owners.isPending && <p role='status'>Loading owners…</p>}
      {owners.isError && (
        <p role='alert'>
          Could not load owners.{' '}
          <Button variant='outline' onClick={() => void owners.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {owners.data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Access</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {owners.data.owners.map((owner) => (
              <TableRow key={owner.id}>
                <TableCell>{owner.id}</TableCell>
                <TableCell>{owner.kind}</TableCell>
                <TableCell>{owner.name}</TableCell>
                <TableCell>
                  <Button
                    variant='outline'
                    disabled={saving}
                    onClick={() => {
                      setOwnerId(owner.id)
                      setAllowed(null)
                    }}
                  >
                    Check access
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!owners.data.owners.length && (
              <TableRow>
                <TableCell colSpan={4}>
                  No matching owners. Open your profile to provision your user
                  owner.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      <PageControls
        page={page}
        loading={owners.isFetching}
        hasNext={
          !!owners.data && (page + 1) * owners.data.limit < owners.data.total
        }
        onChange={setPage}
      />
      {ownerId !== null && (
        <section className='space-y-3 rounded-md border p-4'>
          <h2 className='font-semibold'>
            Access decision for owner #{ownerId}
          </h2>
          <Label htmlFor='owner-scope'>Scope</Label>
          <Select
            value={scope}
            disabled={saving}
            onValueChange={(value) => {
              setScope(value)
              setAllowed(null)
            }}
          >
            <SelectTrigger id='owner-scope' className='max-w-sm'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {effective.permissions.map((rule) => (
                <SelectItem key={rule.name} value={rule.name}>
                  {rule.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div
            role='group'
            aria-label='Action'
            className='flex flex-wrap gap-2'
          >
            {(['view', 'add', 'change', 'delete'] as const).map((value) => (
              <Button
                key={value}
                variant={action === value ? 'default' : 'outline'}
                aria-pressed={action === value}
                disabled={saving}
                onClick={() => {
                  setAction(value)
                  setAllowed(null)
                }}
              >
                {value}
              </Button>
            ))}
          </div>
          <Button disabled={saving} onClick={() => void inspect()}>
            Read access decision
          </Button>
          {allowed !== null && (
            <p role='status'>
              {allowed
                ? 'Allowed: permission and ownership requirements are satisfied.'
                : 'Denied: missing permission, ownership, or owner record.'}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
