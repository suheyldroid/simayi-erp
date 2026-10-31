import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAdministrator } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { accessApi, refreshAccess } from '../access-api'
import type { GroupMember } from '../access-model'
import { PageControls } from './page-controls'
import { UserPicker } from './user-picker'

export function GroupMembersPanel({
  groupId,
  canEdit,
  administrator,
}: {
  groupId: number
  canEdit: boolean
  administrator: boolean
}) {
  const [page, setPage] = useState(0)
  const [userId, setUserId] = useState('')
  const [removing, setRemoving] = useState<GroupMember | null>(null)
  const [saving, setSaving] = useState(false)
  const client = useQueryClient()
  const members = useQuery({
    queryKey: ['group-members', groupId, page],
    queryFn: () => accessApi.members(groupId, page),
  })
  async function add() {
    if (!userId) return
    setSaving(true)
    try {
      await accessApi.addMember(groupId, userId)
      setUserId('')
      await refreshAccess(client)
      toast.success('Member added.')
    } catch {
      toast.error('Could not add member. Check delegation limits and reload.')
    } finally {
      setSaving(false)
    }
  }
  async function remove() {
    if (!removing) return
    setSaving(true)
    try {
      await accessApi.removeMember(groupId, removing.id)
      setRemoving(null)
      await refreshAccess(client)
      toast.success('Membership removed; invalid primary group cleared.')
    } catch {
      toast.error(
        'Could not remove member. Check delegation limits and reload.'
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className='space-y-4'>
      {canEdit && (
        <div className='max-w-xl space-y-3 rounded-md border p-4'>
          <UserPicker
            value={userId}
            onChange={setUserId}
            allowAdministrators={administrator}
          />
          <Button disabled={!userId || saving} onClick={() => void add()}>
            Add member
          </Button>
        </div>
      )}
      {members.isPending && <p role='status'>Loading members…</p>}
      {members.isError && (
        <p role='alert'>
          Could not load members.{' '}
          <Button variant='outline' onClick={() => void members.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {members.data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.data.members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>{member.name}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  {canEdit && (administrator || !isAdministrator(member)) && (
                    <Button
                      variant='outline'
                      disabled={saving}
                      onClick={() => setRemoving(member)}
                    >
                      Remove
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!members.data.members.length && (
              <TableRow>
                <TableCell colSpan={3}>No members.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      <PageControls
        page={page}
        loading={members.isFetching}
        hasNext={
          !!members.data && (page + 1) * members.data.limit < members.data.total
        }
        onChange={setPage}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setRemoving(null)
        }}
        title='Remove membership'
        desc={`Remove ${removing?.email ?? ''} from this group? Group permissions and matching ownership access will end immediately.`}
        confirmText='Remove'
        destructive
        isLoading={saving}
        handleConfirm={remove}
      />
    </div>
  )
}
