import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { PageControls } from '@/features/users/components/page-controls'
import { organizationApi, organizationErrorMessage } from './api'
import {
  organizationMemberRoles,
  splitMemberRoles,
  type OrgMember,
} from './model'

function RoleChoices({
  idPrefix,
  selected,
  choices,
  disabled,
  onChange,
}: {
  idPrefix: string
  selected: string[]
  choices: string[]
  disabled: boolean
  onChange: (roles: string[]) => void
}) {
  return (
    <fieldset className='space-y-2' disabled={disabled}>
      <legend className='text-sm font-medium'>Roles</legend>
      {choices.map((role) => {
        const id = `${idPrefix}-${role}`
        return (
          <div key={role} className='flex items-center gap-2'>
            <Checkbox
              id={id}
              checked={selected.includes(role)}
              onCheckedChange={(checked) => {
                onChange(
                  checked === true
                    ? [...selected, role]
                    : selected.filter((item) => item !== role)
                )
              }}
            />
            <Label htmlFor={id}>{role}</Label>
          </div>
        )
      })}
    </fieldset>
  )
}

function assignableRoles(actorRoles: string[]): string[] {
  if (actorRoles.includes('owner')) return [...organizationMemberRoles]
  if (actorRoles.includes('admin'))
    return organizationMemberRoles.filter((role) => role !== 'owner')
  return organizationMemberRoles.filter((role) => role === 'member')
}

export function MembersPanel({
  organizationId,
  actorRoles,
  canCreate,
  canUpdate,
  canDelete,
}: {
  organizationId: string
  actorRoles: string[]
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}) {
  const client = useQueryClient()
  const [page, setPage] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [userId, setUserId] = useState('')
  const [roles, setRoles] = useState<string[]>(['member'])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const choices = assignableRoles(actorRoles)
  const members = useQuery({
    queryKey: ['organization', organizationId, 'members', page],
    queryFn: () => organizationApi.members(organizationId, page * 20),
  })

  async function refresh() {
    await client.invalidateQueries({
      queryKey: ['organization', organizationId, 'members'],
    })
  }

  async function addMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await organizationApi.addMember(organizationId, userId.trim(), roles)
      setUserId('')
      setRoles(['member'])
      setAddOpen(false)
      await refresh()
      toast.success('Member added.')
    } catch (caught) {
      setError(organizationErrorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <p className='max-w-xl text-sm text-muted-foreground'>
          Add a person by their existing user id. Organization owners are not
          platform administrators, and this page does not search the global user
          directory.
        </p>
        {canCreate ? (
          <Sheet
            open={addOpen}
            onOpenChange={(next) => {
              setAddOpen(next)
              if (next) setError('')
            }}
          >
            <SheetTrigger asChild>
              <Button>Add member</Button>
            </SheetTrigger>
            <SheetContent className='flex w-full flex-col gap-0 sm:max-w-md'>
              <form
                className='flex min-h-0 flex-1 flex-col'
                onSubmit={(event) => void addMember(event)}
              >
                <SheetHeader>
                  <SheetTitle>Add existing user</SheetTitle>
                  <SheetDescription>
                    Membership is created inside this organization only. The
                    user id is not looked up in any global directory.
                  </SheetDescription>
                </SheetHeader>
                <div className='min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='member-user-id'>User id</Label>
                    <Input
                      id='member-user-id'
                      required
                      maxLength={128}
                      value={userId}
                      autoComplete='off'
                      onChange={(event) => setUserId(event.target.value)}
                    />
                  </div>
                  <RoleChoices
                    idPrefix='add-member'
                    selected={roles}
                    choices={choices}
                    disabled={pending}
                    onChange={setRoles}
                  />
                </div>
                <SheetFooter>
                  {error ? <p role='alert'>{error}</p> : null}
                  <Button
                    disabled={
                      pending ||
                      roles.length === 0 ||
                      userId.trim().length === 0
                    }
                  >
                    {pending ? 'Adding…' : 'Add member'}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        ) : null}
      </div>
      {members.isPending ? <p role='status'>Loading members…</p> : null}
      {members.isError ? (
        <p role='alert'>
          Could not load members.{' '}
          <Button variant='outline' onClick={() => void members.refetch()}>
            Retry
          </Button>
        </p>
      ) : null}
      {members.data ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>User id</TableHead>
              <TableHead>Roles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.data.members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                organizationId={organizationId}
                choices={choices}
                actorIsOwner={actorRoles.includes('owner')}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onChanged={refresh}
              />
            ))}
            {members.data.members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>No members on this page.</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      ) : null}
      <PageControls
        page={page}
        loading={members.isFetching}
        hasNext={!!members.data && (page + 1) * 20 < members.data.total}
        onChange={setPage}
      />
    </div>
  )
}

function MemberRow({
  member,
  organizationId,
  choices,
  actorIsOwner,
  canUpdate,
  canDelete,
  onChanged,
}: {
  member: OrgMember
  organizationId: string
  choices: string[]
  actorIsOwner: boolean
  canUpdate: boolean
  canDelete: boolean
  onChanged: () => Promise<void>
}) {
  const current = splitMemberRoles(member.role)
  // Native rules keep the owner role owner-only. A legacy custom role label is
  // still displayed and can be replaced by an owner or admin.
  const locked = current.includes('owner') && !actorIsOwner
  const visible = [...new Set([...choices, ...current])]
  const [selected, setSelected] = useState(current)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const unchanged =
    selected.length === current.length &&
    selected.every((role) => current.includes(role))

  async function save() {
    if (!canUpdate || locked) return
    if (selected.length === 0) {
      setError('Choose at least one role.')
      return
    }
    setPending(true)
    setError('')
    try {
      await organizationApi.updateMemberRole(
        organizationId,
        member.id,
        selected
      )
      setEditOpen(false)
      await onChanged()
      toast.success('Member roles updated.')
    } catch (caught) {
      setError(organizationErrorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    if (!canDelete) return
    setPending(true)
    setError('')
    try {
      await organizationApi.removeMember(organizationId, member.id)
      setConfirmRemove(false)
      await onChanged()
      toast.success('Member removed. Their records stay attached to the owner.')
    } catch (caught) {
      setError(organizationErrorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <TableRow>
      <TableCell>{member.user.name}</TableCell>
      <TableCell>{member.user.email}</TableCell>
      <TableCell className='break-all'>{member.userId}</TableCell>
      <TableCell className='space-y-2'>
        <p>{current.join(', ')}</p>
        {canUpdate && !locked ? (
          <Sheet
            open={editOpen}
            onOpenChange={(next) => {
              setEditOpen(next)
              if (next) setError('')
            }}
          >
            <SheetTrigger asChild>
              <Button type='button' variant='outline' size='sm'>
                Edit roles
              </Button>
            </SheetTrigger>
            <SheetContent className='flex w-full flex-col gap-0 sm:max-w-md'>
              <SheetHeader>
                <SheetTitle>Edit member roles</SheetTitle>
                <SheetDescription>
                  {member.user.name} ({member.user.email}). The server still
                  enforces which roles you may grant.
                </SheetDescription>
              </SheetHeader>
              <div className='min-h-0 flex-1 overflow-y-auto px-4 pb-4'>
                <RoleChoices
                  idPrefix={member.id}
                  selected={selected}
                  choices={visible}
                  disabled={pending}
                  onChange={setSelected}
                />
              </div>
              <SheetFooter>
                {editOpen && error ? <p role='alert'>{error}</p> : null}
                <Button
                  type='button'
                  disabled={
                    !canUpdate || pending || unchanged || selected.length === 0
                  }
                  onClick={() => void save()}
                >
                  {pending ? 'Saving…' : 'Save roles'}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        ) : null}
        {locked ? (
          <p className='text-sm text-muted-foreground'>
            Only an organization owner can change this member&apos;s role.
          </p>
        ) : null}
        {canDelete && !locked ? (
          <Button
            type='button'
            variant='outline'
            disabled={pending}
            onClick={() => setConfirmRemove(true)}
          >
            Remove member
          </Button>
        ) : null}
        {!editOpen && !confirmRemove && error ? (
          <p role='alert'>{error}</p>
        ) : null}
        <ConfirmDialog
          open={confirmRemove && canDelete && !locked}
          onOpenChange={setConfirmRemove}
          title={`Remove ${member.user.name} from the organization?`}
          desc='The server can still refuse this removal. Their records stay attached to the organization owner.'
          destructive
          confirmText='Remove member'
          isLoading={pending}
          handleConfirm={() => void remove()}
        >
          {confirmRemove && error ? <p role='alert'>{error}</p> : null}
        </ConfirmDialog>
      </TableCell>
    </TableRow>
  )
}
