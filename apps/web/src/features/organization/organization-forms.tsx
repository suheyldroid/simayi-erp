import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { imageUrl } from '@/lib/image-url'
import { organizationCacheScope } from '@/lib/tenant'
import { Button } from '@/components/ui/button'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ImageInput } from '@/components/image-input'
import {
  membershipListQueryKey,
  organizationApi,
  organizationErrorMessage,
} from './api'
import { organizationLogoApi, organizationLogoPrefix } from './logo-api'
import { slugFromName, type OrganizationRecord } from './model'

async function availableSlug(name: string) {
  let slug = slugFromName(name)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await organizationApi.checkSlug(slug)) return slug
    slug = `${slugFromName(name)}-${crypto.randomUUID().slice(0, 4)}`.slice(
      0,
      48
    )
  }
  throw new Error('Choose a different organization name.')
}

/**
 * Native organization create. The selected logo is uploaded first and the
 * native create stores only its canonical `/media/...` reference. The current
 * active organization is preserved so global pages never switch tenant as a
 * side effect of creating one.
 */
export function CreateOrganizationSheet() {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  function resetDraft() {
    setName('')
    setLogo(null)
    setFile(null)
    setError('')
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const submittedName = name
    const submittedLogo = logo
    const submittedFile = file
    setPending(true)
    setError('')
    try {
      const logoRef = submittedFile
        ? (await organizationLogoApi.upload(submittedFile)).reference
        : submittedLogo
      // Keep the uploaded reference if the native create fails; a retry must
      // reuse it instead of uploading the same file again.
      if (submittedFile) {
        setLogo(logoRef ?? null)
        setFile(null)
      }
      await organizationApi.create({
        name: submittedName.trim(),
        slug: await availableSlug(submittedName),
        logo: logoRef ?? undefined,
        keepCurrentActiveOrganization: true,
      })
      await client.invalidateQueries({ queryKey: membershipListQueryKey })
      resetDraft()
      setOpen(false)
      toast.success(
        'Organization created. Open it from the list when ready to work in it.'
      )
    } catch (caught) {
      setError(organizationErrorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return
        setOpen(next)
        resetDraft()
      }}
    >
      <SheetTrigger asChild>
        <Button>Create organization</Button>
      </SheetTrigger>
      <SheetContent
        className='flex w-full flex-col gap-0 sm:max-w-md'
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => void submit(event)}
        >
          <SheetHeader>
            <SheetTitle>Create organization</SheetTitle>
            <SheetDescription>
              The new organization starts with you as its owner. Your current
              active organization stays selected until you open the new one.
            </SheetDescription>
          </SheetHeader>
          <div className='min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4'>
            <div className='space-y-2'>
              <Label htmlFor='organization-name'>Name</Label>
              <Input
                id='organization-name'
                required
                maxLength={100}
                disabled={pending}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <ImageInput
              image={logo}
              file={file}
              disabled={pending}
              resolveImage={imageUrl}
              credentialImagePrefix={organizationLogoPrefix}
              label='Logo'
              alt='Organization logo preview'
              onChange={(next) => {
                setLogo(next.image)
                setFile(next.file)
              }}
            />
          </div>
          <SheetFooter>
            {error ? <p role='alert'>{error}</p> : null}
            <Button disabled={pending || name.trim().length === 0}>
              {pending ? 'Creating…' : 'Create organization'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function EditOrganizationSheet({
  organization,
  canUpdate,
}: {
  organization: OrganizationRecord
  canUpdate: boolean
}) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(organization.name)
  const [slug, setSlug] = useState(organization.slug)
  const [logo, setLogo] = useState<string | null>(organization.logo ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  function resetDraft() {
    setName(organization.name)
    setSlug(organization.slug)
    setLogo(organization.logo ?? null)
    setFile(null)
    setError('')
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canUpdate) {
      setError(
        'Only organization owners and admins can update this organization.'
      )
      return
    }
    if (pending) return
    const submittedName = name
    const submittedSlug = slug
    const submittedLogo = logo
    const submittedFile = file
    setPending(true)
    setError('')
    try {
      const logoRef = submittedFile
        ? (await organizationLogoApi.upload(submittedFile)).reference
        : submittedLogo
      // Keep the uploaded reference if the native update fails; a retry must
      // reuse it instead of uploading the same file again.
      if (submittedFile) {
        setLogo(logoRef ?? null)
        setFile(null)
      }
      // Omit an unchanged logo entirely: re-sending a historical data URI would
      // be rejected and must not be written again. Changing or removing it
      // sends the canonical reference or null explicitly.
      const logoChanged =
        submittedFile !== null ||
        (logoRef ?? null) !== (organization.logo ?? null)
      const updated = await organizationApi.update(organization.id, {
        name: submittedName.trim(),
        slug: submittedSlug.trim(),
        ...(logoChanged ? { logo: logoRef ?? null } : {}),
      })
      const renamed = updated !== null && updated.slug !== organization.slug
      if (renamed) {
        // Refresh native memberships before moving, so the slug boundary can
        // resolve the new canonical URL instead of the stale one.
        await client.fetchQuery({
          queryKey: membershipListQueryKey,
          queryFn: () => organizationApi.list(),
          staleTime: 0,
        })
      } else {
        await client.invalidateQueries({ queryKey: membershipListQueryKey })
        // The slug route exposes its organization from static route context;
        // invalidating the membership query alone does not refresh it. Re-run
        // the route guard so reopening this sheet reads the saved native
        // record instead of the context captured before the update.
        await router.invalidate()
      }
      void client.invalidateQueries({
        queryKey: [
          'organization',
          organizationCacheScope(),
          'detail',
          organization.id,
        ],
      })
      setFile(null)
      setLogo(updated?.logo ?? logoRef)
      setOpen(false)
      if (renamed) {
        // This page lives under the old slug; navigate to the canonical new
        // slug so the boundary never re-runs its old-slug guard.
        await navigate({
          to: '/o/$organizationSlug',
          params: { organizationSlug: updated.slug },
          replace: true,
        })
        toast.success('Organization updated and moved to its new slug.')
        return
      }
      toast.success('Organization updated.')
    } catch (caught) {
      setError(organizationErrorMessage(caught))
    } finally {
      setPending(false)
    }
  }

  if (!canUpdate) return null

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return
        setOpen(next)
        resetDraft()
      }}
    >
      <SheetTrigger asChild>
        <Button variant='outline'>Edit organization</Button>
      </SheetTrigger>
      <SheetContent
        className='flex w-full flex-col gap-0 sm:max-w-md'
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => void save(event)}
        >
          <SheetHeader>
            <SheetTitle>Organization settings</SheetTitle>
            <SheetDescription>
              Name, slug and logo for {organization.name}.
            </SheetDescription>
          </SheetHeader>
          <div className='min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4'>
            <fieldset disabled={pending} className='space-y-3'>
              <div className='space-y-2'>
                <Label htmlFor='edit-organization-name'>Name</Label>
                <Input
                  id='edit-organization-name'
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='edit-organization-slug'>Slug</Label>
                <Input
                  id='edit-organization-slug'
                  required
                  maxLength={48}
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                />
              </div>
              <ImageInput
                image={logo}
                file={file}
                disabled={pending}
                resolveImage={imageUrl}
                credentialImagePrefix={organizationLogoPrefix}
                label='Logo'
                alt='Organization logo preview'
                onChange={(next) => {
                  setLogo(next.image)
                  setFile(next.file)
                }}
              />
            </fieldset>
            {error ? <p role='alert'>{error}</p> : null}
          </div>
          <SheetFooter>
            <Button
              disabled={
                !canUpdate ||
                pending ||
                name.trim().length === 0 ||
                slug.trim().length === 0
              }
            >
              {pending ? 'Saving…' : 'Save organization'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function DeleteOrganizationButton({
  organization,
  canDelete,
}: {
  organization: OrganizationRecord
  canDelete: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    if (!canDelete) return
    setPending(true)
    setError('')
    try {
      await organizationApi.remove(organization.id)
    } catch (caught) {
      setPending(false)
      setError(organizationErrorMessage(caught))
    }
  }

  if (!canDelete) return null

  return (
    <>
      <Button
        type='button'
        variant='destructive'
        disabled={pending}
        onClick={() => setConfirmDelete(true)}
      >
        Delete organization
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(next) => {
          setConfirmDelete(next)
          if (next) setError('')
        }}
        title='Delete this organization?'
        desc='The server can still refuse this delete.'
        destructive
        confirmText='Delete organization'
        isLoading={pending}
        handleConfirm={() => void remove()}
      >
        {confirmDelete && error ? <p role='alert'>{error}</p> : null}
      </ConfirmDialog>
    </>
  )
}
