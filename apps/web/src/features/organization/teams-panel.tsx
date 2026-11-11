import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { organizationSessionQueryKey } from '@/lib/auth'
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { organizationApi, organizationErrorMessage } from './api'
import type { OrgMember, OrgTeam } from './model'

export function TeamsPanel({
  organizationId,
  activeTeamId,
  currentUserId,
  canCreate,
  canUpdate,
  canDelete,
  canAddMember,
  canRemoveMember,
}: {
  organizationId: string
  activeTeamId: string | null
  currentUserId: string
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canAddMember: boolean
  canRemoveMember: boolean
}) {
  const client = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const teams = useQuery({
    queryKey: ['organization', organizationId, 'teams'],
    queryFn: () => organizationApi.teams(organizationId),
  })
  const members = useQuery({
    queryKey: ['organization', organizationId, 'members', 'teams'],
    queryFn: async () => {
      const first = await organizationApi.members(organizationId, 0, 100)
      const rows = [...first.members]
      let offset = rows.length
      while (offset < first.total) {
        const page = await organizationApi.members(organizationId, offset, 100)
        if (page.members.length === 0) break
        rows.push(...page.members)
        offset += page.members.length
      }
      return { members: rows, total: first.total }
    },
  })
  const selected =
    teams.data?.find((team) => team.id === selectedId) ??
    teams.data?.[0] ??
    null

  async function refresh() {
    await Promise.all([
      client.invalidateQueries({
        queryKey: ['organization', organizationId, 'teams'],
      }),
      client.invalidateQueries({
        queryKey: ['organization', organizationId, 'team-members'],
      }),
      client.invalidateQueries({ queryKey: organizationSessionQueryKey }),
    ])
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const team = await organizationApi.createTeam(organizationId, name.trim())
      setName('')
      setSelectedId(team.id)
      setCreateOpen(false)
      await refresh()
      toast.success('Team created.')
    } catch (caught) {
      setError(organizationErrorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='max-w-xl text-sm text-muted-foreground'>
          Teams group people and can own records. Team membership does not grant
          or revoke roles.
        </p>
        {canCreate ? (
          <Sheet
            open={createOpen}
            onOpenChange={(next) => {
              setCreateOpen(next)
              if (next) setError('')
            }}
          >
            <SheetTrigger asChild>
              <Button>Create team</Button>
            </SheetTrigger>
            <SheetContent className='flex w-full flex-col gap-0 sm:max-w-md'>
              <form
                className='flex min-h-0 flex-1 flex-col'
                onSubmit={(event) => void create(event)}
              >
                <SheetHeader>
                  <SheetTitle>Create team</SheetTitle>
                  <SheetDescription>
                    Teams group people inside this organization. Creating one
                    does not change anyone&apos;s role.
                  </SheetDescription>
                </SheetHeader>
                <div className='min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='team-name'>Name</Label>
                    <Input
                      id='team-name'
                      required
                      maxLength={100}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </div>
                </div>
                <SheetFooter>
                  {error ? <p role='alert'>{error}</p> : null}
                  <Button disabled={pending || name.trim().length === 0}>
                    {pending ? 'Creating…' : 'Create team'}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        ) : null}
      </div>
      {teams.isPending ? <p role='status'>Loading teams…</p> : null}
      {teams.isError ? (
        <p role='alert'>
          Could not load teams.{' '}
          <Button variant='outline' onClick={() => void teams.refetch()}>
            Retry
          </Button>
        </p>
      ) : null}
      {teams.data && teams.data.length === 0 ? <p>No teams yet.</p> : null}
      {teams.data && teams.data.length > 0 && selected ? (
        <div className='space-y-2'>
          <Label htmlFor='team-select'>Team</Label>
          <Select value={selected.id} onValueChange={setSelectedId}>
            <SelectTrigger id='team-select' className='max-w-md'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {teams.data.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TeamDetail
            key={selected.id}
            organizationId={organizationId}
            team={selected}
            active={activeTeamId === selected.id}
            currentUserId={currentUserId}
            members={members.data?.members ?? []}
            membersError={members.isError}
            canUpdate={canUpdate}
            canDelete={canDelete}
            canAddMember={canAddMember}
            canRemoveMember={canRemoveMember}
            onChanged={refresh}
          />
        </div>
      ) : null}
    </div>
  )
}

function TeamDetail({
  organizationId,
  team,
  active,
  currentUserId,
  members,
  membersError,
  canUpdate,
  canDelete,
  canAddMember,
  canRemoveMember,
  onChanged,
}: {
  organizationId: string
  team: OrgTeam
  active: boolean
  currentUserId: string
  members: OrgMember[]
  membersError: boolean
  canUpdate: boolean
  canDelete: boolean
  canAddMember: boolean
  canRemoveMember: boolean
  onChanged: () => Promise<void>
}) {
  const [name, setName] = useState(team.name)
  const [userId, setUserId] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<{
    userId: string
    label: string
  } | null>(null)
  const roster = useQuery({
    queryKey: ['organization', organizationId, 'team-members', team.id],
    queryFn: () => organizationApi.teamMembers(team.id),
  })
  const names = new Map(members.map((member) => [member.userId, member]))

  async function rename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await organizationApi.updateTeam(organizationId, team.id, name.trim())
      setEditOpen(false)
      await onChanged()
      toast.success('Team renamed.')
    } catch (caught) {
      setError(organizationErrorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  async function removeTeam() {
    if (!canDelete) return
    setPending(true)
    setError('')
    try {
      await organizationApi.removeTeam(organizationId, team.id)
      setConfirmDelete(false)
      await onChanged()
      toast.success('Team deleted.')
    } catch (caught) {
      setError(organizationErrorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  async function changeMembership(targetUserId: string, add: boolean) {
    if (add ? !canAddMember : !canRemoveMember) return false
    setPending(true)
    setError('')
    let succeeded = false
    try {
      if (add)
        await organizationApi.addTeamMember(
          organizationId,
          team.id,
          targetUserId
        )
      else
        await organizationApi.removeTeamMember(
          organizationId,
          team.id,
          targetUserId
        )
      await onChanged()
      toast.success(add ? 'Team member added.' : 'Team member removed.')
      succeeded = true
    } catch (caught) {
      setError(organizationErrorMessage(caught))
    } finally {
      setPending(false)
    }
    return succeeded
  }

  async function addMember() {
    if (await changeMembership(userId, true)) {
      setUserId('')
      setAddOpen(false)
    }
  }

  async function confirmRemoveMember() {
    if (!pendingRemoval) return
    if (await changeMembership(pendingRemoval.userId, false))
      setPendingRemoval(null)
  }

  async function toggleActiveTeam() {
    setPending(true)
    setError('')
    try {
      await organizationApi.activateTeam(
        organizationId,
        active ? null : team.id
      )
    } catch (caught) {
      setPending(false)
      setError(organizationErrorMessage(caught))
    }
  }

  return (
    <div className='space-y-4 rounded-md border p-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 className='font-semibold'>{team.name}</h2>
        {canUpdate ? (
          <Sheet
            open={editOpen}
            onOpenChange={(next) => {
              setEditOpen(next)
              if (next) setError('')
            }}
          >
            <SheetTrigger asChild>
              <Button variant='outline'>Edit team</Button>
            </SheetTrigger>
            <SheetContent className='flex w-full flex-col gap-0 sm:max-w-md'>
              <form
                className='flex min-h-0 flex-1 flex-col'
                onSubmit={(event) => void rename(event)}
              >
                <SheetHeader>
                  <SheetTitle>Edit team</SheetTitle>
                  <SheetDescription>
                    Rename this team. Its id and member roster stay the same.
                  </SheetDescription>
                </SheetHeader>
                <div className='min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4'>
                  <div className='space-y-2'>
                    <Label htmlFor={`team-rename-${team.id}`}>
                      Display name
                    </Label>
                    <Input
                      id={`team-rename-${team.id}`}
                      required
                      maxLength={100}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </div>
                </div>
                <SheetFooter>
                  {error ? <p role='alert'>{error}</p> : null}
                  <Button
                    disabled={
                      pending ||
                      name.trim().length === 0 ||
                      name.trim() === team.name
                    }
                  >
                    {pending ? 'Saving…' : 'Save team'}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        ) : null}
      </div>
      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='outline'
          disabled={pending}
          onClick={() => void toggleActiveTeam()}
        >
          {active ? 'Clear active team' : 'Use as active team'}
        </Button>
        {canDelete ? (
          <Button
            type='button'
            variant='destructive'
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
          >
            Delete team
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmDelete && canDelete}
        onOpenChange={setConfirmDelete}
        title='Delete this team?'
        desc='The server can still refuse this delete. Team memberships end; records stay with the organization.'
        destructive
        confirmText='Delete team'
        isLoading={pending}
        handleConfirm={() => void removeTeam()}
      />
      <div className='space-y-2'>
        <h3 className='font-medium'>Members</h3>
        {roster.isPending ? <p role='status'>Loading team members…</p> : null}
        {roster.isError ? (
          <div className='space-y-2'>
            <p role='alert'>{organizationErrorMessage(roster.error)}</p>
            <p className='text-sm text-muted-foreground'>
              Native team member listing is available to current members of this
              team.
            </p>
            {canAddMember ? (
              <Button
                type='button'
                disabled={pending}
                onClick={() => void changeMembership(currentUserId, true)}
              >
                Add me to this team
              </Button>
            ) : null}
          </div>
        ) : null}
        {roster.data ? (
          <ul className='space-y-2'>
            {roster.data.map((entry) => {
              const member = names.get(entry.userId)
              return (
                <li
                  key={entry.id}
                  className='flex flex-wrap items-center gap-2'
                >
                  <span>
                    {member
                      ? `${member.user.name} (${member.user.email})`
                      : entry.userId}
                  </span>
                  {canRemoveMember ? (
                    <Button
                      type='button'
                      variant='outline'
                      disabled={pending}
                      onClick={() =>
                        setPendingRemoval({
                          userId: entry.userId,
                          label: member ? member.user.name : entry.userId,
                        })
                      }
                    >
                      Remove
                    </Button>
                  ) : null}
                </li>
              )
            })}
            {roster.data.length === 0 ? <li>No team members.</li> : null}
          </ul>
        ) : null}
        {canAddMember && roster.data ? (
          membersError ? (
            <p role='alert'>
              Could not load organization members for the picker.
            </p>
          ) : (
            <Sheet
              open={addOpen}
              onOpenChange={(next) => {
                setAddOpen(next)
                if (next) setError('')
              }}
            >
              <SheetTrigger asChild>
                <Button type='button'>Add member</Button>
              </SheetTrigger>
              <SheetContent className='flex w-full flex-col gap-0 sm:max-w-md'>
                <div className='flex min-h-0 flex-1 flex-col'>
                  <SheetHeader>
                    <SheetTitle>Add team member</SheetTitle>
                    <SheetDescription>
                      Pick an existing organization member. This only changes
                      team membership, not roles.
                    </SheetDescription>
                  </SheetHeader>
                  <div className='min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4'>
                    <div className='space-y-2'>
                      <Label htmlFor={`team-add-${team.id}`}>
                        Organization member
                      </Label>
                      <Select
                        value={userId || undefined}
                        onValueChange={setUserId}
                        disabled={pending}
                      >
                        <SelectTrigger id={`team-add-${team.id}`}>
                          <SelectValue placeholder='Select member' />
                        </SelectTrigger>
                        <SelectContent>
                          {members
                            .filter(
                              (member) =>
                                !roster.data.some(
                                  (entry) => entry.userId === member.userId
                                )
                            )
                            .map((member) => (
                              <SelectItem
                                key={member.userId}
                                value={member.userId}
                              >
                                {member.user.name} ({member.user.email})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <SheetFooter>
                    {addOpen && error ? <p role='alert'>{error}</p> : null}
                    <Button
                      type='button'
                      disabled={pending || userId.length === 0}
                      onClick={() => void addMember()}
                    >
                      {pending ? 'Adding…' : 'Add to team'}
                    </Button>
                  </SheetFooter>
                </div>
              </SheetContent>
            </Sheet>
          )
        ) : null}
      </div>
      {!editOpen && !addOpen && !pendingRemoval && error ? (
        <p role='alert'>{error}</p>
      ) : null}
      <ConfirmDialog
        open={pendingRemoval !== null && canRemoveMember}
        onOpenChange={(next) => {
          if (!next) setPendingRemoval(null)
        }}
        title={`Remove ${pendingRemoval?.label ?? 'this member'} from the team?`}
        desc='The server can still refuse this removal. Only the team assignment is removed.'
        destructive
        confirmText='Remove member'
        isLoading={pending}
        handleConfirm={() => void confirmRemoveMember()}
      >
        {pendingRemoval && error ? <p role='alert'>{error}</p> : null}
      </ConfirmDialog>
    </div>
  )
}
