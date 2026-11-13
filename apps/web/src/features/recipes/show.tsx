import { useState } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { parseResourceUuid } from '@/lib/resource-uuid'
import { organizationCacheScope } from '@/lib/tenant'
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
import { errorMessage, recipeApi } from './api'
import { RecipeSheet } from './components/recipe-sheet'
import type { RecipeCreateInput, RecipeDetail as RecipeRecord } from './model'

const recipeRoute = getRouteApi(
  '/_authenticated/o/$organizationSlug/settings/recipes/$recipeId'
)

type EditDraft = {
  key: string
  uuid: string
  version: number
  recipe: RecipeRecord
}

type DeleteDraft = {
  uuid: string
  version: number
  name: string
}

export function RecipeDetail() {
  const { recipeId } = recipeRoute.useParams()
  const uuid = parseResourceUuid(recipeId)
  return <RecipeDetailView key={uuid ?? 'invalid'} uuid={uuid} />
}

function RecipeDetailView({ uuid }: { uuid: string | null }) {
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const navigate = useNavigate()
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const [deleteDraft, setDeleteDraft] = useState<DeleteDraft | null>(null)
  const details = useQuery({
    queryKey: ['recipe', 'recipes', organizationCacheScope(), 'detail', uuid],
    queryFn: () => {
      if (uuid === null) throw new Error('Recipe UUID is required')
      return recipeApi.recipe(uuid)
    },
    enabled: uuid !== null,
  })
  const detailStatus =
    details.error && axios.isAxiosError(details.error)
      ? details.error.response?.status
      : undefined
  const record = details.data
  const invalidateRecipeQueries = async () => {
    await Promise.all([
      client.invalidateQueries({
        queryKey: ['recipe', 'recipes', organizationCacheScope()],
      }),
      client.invalidateQueries({
        queryKey: [
          'recipe',
          'recipes',
          'sales-picker',
          organizationCacheScope(),
        ],
      }),
    ])
  }
  const update = useMutation({
    mutationFn: (input: {
      draftUuid: string
      version: number
      body: RecipeCreateInput
    }) =>
      recipeApi.update(input.draftUuid, {
        version: input.version,
        ...input.body,
      }),
    onSuccess: async () => {
      setEditDraft(null)
      await invalidateRecipeQueries()
      toast.success('Recipe updated')
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  })
  const deletion = useMutation({
    mutationFn: (input: { draftUuid: string; version: number }) =>
      recipeApi.remove(input.draftUuid, input.version),
    onSuccess: async () => {
      setDeleteDraft(null)
      await invalidateRecipeQueries()
      toast.success('Recipe deleted')
      await navigate({
        to: '/o/$organizationSlug/settings/recipes',
        params: { organizationSlug },
      })
    },
    onError: () => {
      void client.invalidateQueries({
        queryKey: [
          'recipe',
          'recipes',
          organizationCacheScope(),
          'detail',
          uuid,
        ],
      })
    },
  })
  const reloadDraft = async () => {
    const draftKey = editDraft?.key
    if (draftKey === undefined) return
    const result = await details.refetch()
    if (result.isError || !result.data) {
      toast.error(
        result.error
          ? `Could not reload the recipe: ${errorMessage(result.error)}`
          : 'Could not reload the recipe.'
      )
      return
    }
    const fresh = result.data
    update.reset()
    setEditDraft((current) =>
      current?.key === draftKey
        ? {
            key: crypto.randomUUID(),
            uuid: fresh.uuid,
            version: fresh.version,
            recipe: fresh,
          }
        : current
    )
  }
  return (
    <>
      <section className='space-y-6'>
        <div>
          <Link
            to='/o/$organizationSlug/settings/recipes'
            params={{ organizationSlug }}
            className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Back to recipes
          </Link>
          <h2 className='mt-2 text-2xl font-bold'>
            {record && !details.isError ? record.name : 'Recipe details'}
          </h2>
        </div>
        {uuid === null && <p role='alert'>Recipe not found.</p>}
        {uuid !== null && details.isPending && (
          <p role='status'>Loading recipe…</p>
        )}
        {uuid !== null && details.isError && detailStatus === 404 && (
          <p role='alert'>Recipe not found.</p>
        )}
        {uuid !== null && details.isError && detailStatus !== 404 && (
          <p role='alert'>
            {errorMessage(details.error)}{' '}
            <Button variant='outline' onClick={() => void details.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {record && !details.isError && (
          <>
            <section className='space-y-4 rounded-md border border-border p-4'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <h3 className='text-xl font-semibold'>{record.name}</h3>
                  <p className='text-sm text-muted-foreground'>
                    {record.description || 'No description.'}
                  </p>
                </div>
                <div className='flex flex-wrap gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => {
                      update.reset()
                      setEditDraft({
                        key: crypto.randomUUID(),
                        uuid: record.uuid,
                        version: record.version,
                        recipe: record,
                      })
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type='button'
                    variant='destructive'
                    onClick={() => {
                      deletion.reset()
                      setDeleteDraft({
                        uuid: record.uuid,
                        version: record.version,
                        name: record.name,
                      })
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
                <dt>Active</dt>
                <dd>{record.active ? 'Yes' : 'No'}</dd>
                <dt>Version</dt>
                <dd>{record.version}</dd>
                <dt>Ingredients</dt>
                <dd>{record.ingredientCount}</dd>
                <dt>Created</dt>
                <dd>{new Date(record.createdAt).toLocaleString()}</dd>
                <dt>Updated</dt>
                <dd>{new Date(record.updatedAt).toLocaleString()}</dd>
              </dl>
            </section>
            <section className='space-y-2'>
              <h3 className='text-xl font-semibold'>Ingredients</h3>
              <Table>
                <caption className='sr-only'>
                  Ingredient items and quantities of this recipe
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>IPN</TableHead>
                    <TableHead>Quantity per recipe</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {record.ingredients.map((ingredient) => (
                    <TableRow key={ingredient.uuid}>
                      <TableCell>{ingredient.item.name}</TableCell>
                      <TableCell>{ingredient.item.ipn || '—'}</TableCell>
                      <TableCell>{ingredient.quantity}</TableCell>
                      <TableCell>
                        {ingredient.item.units || 'Unresolved'}
                      </TableCell>
                      <TableCell>{ingredient.note || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {record.ingredients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        This recipe has no ingredients.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </section>
          </>
        )}
      </section>
      {editDraft && editDraft.uuid === uuid && (
        <RecipeSheet
          key={editDraft.key}
          recipe={editDraft.recipe}
          pending={update.isPending}
          error={update.error}
          onClose={() => {
            setEditDraft(null)
            const failed = update.isError
            update.reset()
            if (failed)
              void client.invalidateQueries({
                queryKey: [
                  'recipe',
                  'recipes',
                  organizationCacheScope(),
                  'detail',
                  uuid,
                ],
              })
          }}
          onReload={() => void reloadDraft()}
          onSubmit={(body) =>
            update.mutate({
              draftUuid: editDraft.uuid,
              version: editDraft.version,
              body,
            })
          }
        />
      )}
      <ConfirmDialog
        open={deleteDraft != null && deleteDraft.uuid === uuid}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDraft(null)
            deletion.reset()
          }
        }}
        title='Delete recipe'
        desc={
          deleteDraft
            ? `Delete “${deleteDraft.name}”? Historical sale snapshots keep their recorded ingredients and stock consumption.`
            : ''
        }
        confirmText='Delete'
        destructive
        disabled={deletion.isError}
        isLoading={deletion.isPending}
        handleConfirm={() => {
          if (deleteDraft)
            deletion.mutate({
              draftUuid: deleteDraft.uuid,
              version: deleteDraft.version,
            })
        }}
      >
        {deletion.isError && (
          <p role='alert' className='text-sm text-destructive'>
            {errorMessage(deletion.error)} Cancel and choose Delete again to use
            the latest recipe version.
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}
