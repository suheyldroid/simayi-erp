import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { accessApi, refreshAccess } from '../access-api'
import {
  hasPermission,
  type EffectivePermissions,
  type Group,
} from '../access-model'
import { GroupMembersPanel } from './group-members-panel'
import { PageControls } from './page-controls'
import { RuleSetMatrix } from './ruleset-matrix'

function GroupNameForm({
  group,
  onSaved,
}: {
  group?: Group
  onSaved?: (group: Group) => void
}) {
  const client = useQueryClient()
  const form = useForm({ defaultValues: { name: group?.name ?? '' } })
  async function save(body: { name: string }) {
    try {
      const saved = group
        ? await accessApi.renameGroup(group.id, body.name.trim())
        : await accessApi.createGroup(body.name.trim())
      form.reset({ name: group ? saved.name : '' })
      await refreshAccess(client)
      onSaved?.(saved)
      toast.success('Group saved.')
    } catch {
      form.setError('root', {
        message: 'Could not save. Check the name, grants, and uniqueness.',
      })
    }
  }
  return (
    <form
      className='flex flex-wrap items-end gap-3'
      onSubmit={form.handleSubmit(save)}
    >
      <div className='space-y-2'>
        <Label htmlFor={`group-name-${group?.id ?? 'new'}`}>
          {group ? 'Group name' : 'New group'}
        </Label>
        <Input
          id={`group-name-${group?.id ?? 'new'}`}
          required
          maxLength={150}
          {...form.register('name', {
            required: true,
            validate: (value) => !!value.trim(),
          })}
        />
        {form.formState.errors.name && (
          <p role='alert' className='text-destructive'>
            Enter a group name.
          </p>
        )}
      </div>
      <Button disabled={form.formState.isSubmitting}>
        {group ? 'Rename' : 'Create group'}
      </Button>
      {form.formState.errors.root && (
        <p role='alert' className='w-full text-destructive'>
          {form.formState.errors.root.message}
        </p>
      )}
    </form>
  )
}

function GroupWorkspace({
  id,
  effective,
  onClose,
}: {
  id: number
  effective: EffectivePermissions
  onClose: () => void
}) {
  const group = useQuery({
    queryKey: ['group', id],
    queryFn: () => accessApi.group(id),
  })
  if (group.isPending) return <p role='status'>Loading group…</p>
  if (group.isError)
    return (
      <p role='alert'>
        Could not load group.{' '}
        <Button variant='outline' onClick={() => void group.refetch()}>
          Retry
        </Button>
        <Button variant='ghost' onClick={onClose}>
          Close
        </Button>
      </p>
    )
  const canEdit =
    group.data.canManage && hasPermission(effective, 'admin', 'change')
  return (
    <section className='space-y-4 rounded-md border p-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-xl font-semibold'>{group.data.name}</h2>
        <Button variant='ghost' onClick={onClose}>
          Close group
        </Button>
      </div>
      {canEdit ? (
        <GroupNameForm group={group.data} />
      ) : (
        <p className='text-sm text-muted-foreground'>
          Read-only: administrative groups and grants exceeding your own require
          a platform administrator.
        </p>
      )}
      <Tabs defaultValue='members'>
        <TabsList>
          <TabsTrigger value='members'>Members</TabsTrigger>
          <TabsTrigger value='rules'>RuleSet</TabsTrigger>
        </TabsList>
        <TabsContent value='members'>
          <GroupMembersPanel
            groupId={id}
            canEdit={canEdit}
            administrator={effective.isAdministrator}
          />
        </TabsContent>
        <TabsContent value='rules'>
          <RuleSetMatrix
            groupId={id}
            canEdit={canEdit}
            administrator={effective.isAdministrator}
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}

export function GroupsPanel({
  effective,
}: {
  effective: EffectivePermissions
}) {
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<Group | null>(null)
  const [saving, setSaving] = useState(false)
  const client = useQueryClient()
  const groups = useQuery({
    queryKey: ['groups', page],
    queryFn: () => accessApi.groups(page),
  })
  async function remove() {
    if (!deleting) return
    setSaving(true)
    try {
      await accessApi.deleteGroup(deleting.id)
      if (selected === deleting.id) setSelected(null)
      setDeleting(null)
      await refreshAccess(client)
      toast.success('Group deleted.')
    } catch {
      toast.error('Could not delete group. Check delegation limits and reload.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className='space-y-5'>
      <p className='text-sm text-muted-foreground'>
        Group permissions are additive. New groups start with no permissions.
        Delegates can grant only permissions they already hold.
      </p>
      {hasPermission(effective, 'admin', 'add') && (
        <GroupNameForm
          onSaved={(group) => {
            setSelected(group.id)
            setPage(0)
          }}
        />
      )}
      {groups.isPending && <p role='status'>Loading groups…</p>}
      {groups.isError && (
        <p role='alert'>
          Could not load groups.{' '}
          <Button variant='outline' onClick={() => void groups.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {groups.data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.data.groups.map((group) => (
              <TableRow key={group.id}>
                <TableCell>{group.name}</TableCell>
                <TableCell>{group.memberCount}</TableCell>
                <TableCell>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      onClick={() => setSelected(group.id)}
                      aria-label={`View ${group.name}`}
                    >
                      View / manage
                    </Button>
                    {group.canManage &&
                      hasPermission(effective, 'admin', 'delete') && (
                        <Button
                          variant='outline'
                          onClick={() => setDeleting(group)}
                          aria-label={`Delete ${group.name}`}
                        >
                          Delete
                        </Button>
                      )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!groups.data.groups.length && (
              <TableRow>
                <TableCell colSpan={3}>No groups.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
      <PageControls
        page={page}
        loading={groups.isFetching}
        hasNext={
          !!groups.data && (page + 1) * groups.data.limit < groups.data.total
        }
        onChange={setPage}
      />
      {selected !== null && (
        <GroupWorkspace
          key={selected}
          id={selected}
          effective={effective}
          onClose={() => setSelected(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !saving) setDeleting(null)
        }}
        title='Delete group'
        desc={`Delete ${deleting?.name ?? ''}? Memberships, RuleSets, and group ownership will be removed. Primary-group references will be cleared.`}
        confirmText='Delete group'
        destructive
        isLoading={saving}
        handleConfirm={remove}
      />
    </div>
  )
}
