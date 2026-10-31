import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sessionQuery } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { permissionsQuery } from './access-api'
import { hasPermission } from './access-model'
import { ErpProfilePanel } from './components/erp-profile-panel'
import { GroupsPanel } from './components/groups-panel'
import { OwnersPanel } from './components/owners-panel'
import { PermissionsPanel } from './components/permissions-panel'
import { UserCredentialsForm } from './components/user-credentials-form'
import { UserDirectory } from './components/user-directory'
import { UserProfileDialog } from './components/user-profile-dialog'
import { UserStatusDialog } from './components/user-status-dialog'
import type { User } from './model'

export function Users() {
  const [tab, setTab] = useState('profile')
  const [credentialsTarget, setCredentialsTarget] = useState<
    User | 'new' | null
  >(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [statusTarget, setStatusTarget] = useState<User | null>(null)
  const { data: currentUser } = useQuery(sessionQuery)
  const permissions = useQuery(permissionsQuery)
  const effective = permissions.isError ? undefined : permissions.data
  const canManage = hasPermission(effective, 'admin', 'view')
  const activeTab =
    !canManage && (tab === 'users' || tab === 'groups') ? 'profile' : tab
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>Users and permissions</h1>
          <p className='text-muted-foreground'>
            Profiles, groups, memberships, RuleSets, and ownership.
          </p>
        </div>
        {permissions.isPending && <p role='status'>Loading permissions…</p>}
        {permissions.isError && (
          <p role='alert'>
            Could not load permissions. Apply the users-permissions migration if
            this is a new installation.{' '}
            <Button
              variant='outline'
              onClick={() => void permissions.refetch()}
            >
              Retry
            </Button>
          </p>
        )}
        {effective && currentUser && !permissions.isError && (
          <Tabs value={activeTab} onValueChange={setTab}>
            <TabsList className='h-auto flex-wrap'>
              <TabsTrigger value='profile'>My profile</TabsTrigger>
              <TabsTrigger value='permissions'>My permissions</TabsTrigger>
              <TabsTrigger value='owners'>Ownership</TabsTrigger>
              {canManage && (
                <>
                  <TabsTrigger value='users'>Users</TabsTrigger>
                  <TabsTrigger value='groups'>Groups / RuleSet</TabsTrigger>
                </>
              )}
            </TabsList>
            <TabsContent value='profile'>
              <ErpProfilePanel userId={currentUser.id} />
            </TabsContent>
            <TabsContent value='permissions'>
              <PermissionsPanel effective={effective} />
            </TabsContent>
            <TabsContent value='owners'>
              <OwnersPanel effective={effective} />
            </TabsContent>
            {canManage && (
              <>
                <TabsContent value='users'>
                  <UserDirectory
                    administrator={effective.isAdministrator}
                    onProfile={setProfileId}
                    onStatus={setStatusTarget}
                    onCredentials={setCredentialsTarget}
                  />
                </TabsContent>
                <TabsContent value='groups'>
                  <GroupsPanel effective={effective} />
                </TabsContent>
              </>
            )}
          </Tabs>
        )}
      </Main>
      {effective && currentUser && (
        <UserProfileDialog
          userId={canManage ? profileId : null}
          actorId={currentUser.id}
          effective={effective}
          onClose={() => setProfileId(null)}
        />
      )}
      {effective?.isAdministrator && (
        <>
          <UserStatusDialog
            user={statusTarget}
            onClose={() => setStatusTarget(null)}
          />
          <Dialog
            open={credentialsTarget !== null}
            onOpenChange={(open) => {
              if (!open) setCredentialsTarget(null)
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {credentialsTarget === 'new'
                    ? 'Create user'
                    : 'Reset password'}
                </DialogTitle>
                <DialogDescription>
                  {credentialsTarget === 'new'
                    ? 'Create a regular user through Better Auth.'
                    : `Set a new password for ${credentialsTarget?.email ?? ''} through Better Auth.`}
                </DialogDescription>
              </DialogHeader>
              {credentialsTarget && (
                <UserCredentialsForm
                  key={
                    credentialsTarget === 'new' ? 'new' : credentialsTarget.id
                  }
                  target={credentialsTarget}
                  onSaved={() => setCredentialsTarget(null)}
                />
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  )
}
