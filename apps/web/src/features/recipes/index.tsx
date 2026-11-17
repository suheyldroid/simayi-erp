import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useOptionalBranch, type BranchContext } from '@/lib/branch-boundary'
import {
  branchCacheScope,
  captureBranchScope,
  isBranchScopeCurrent,
  type CapturedBranchScope,
} from '@/lib/branch-scope'
import { locale, t } from '@/lib/i18n'
import { useOrganizationSlug } from '@/lib/organization-boundary'
import { organizationLocation } from '@/lib/organization-navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  SortableDataTable,
  type SortableColumn,
} from '@/components/data-table/sortable-data-table'
import { BranchInactiveNotice } from '@/components/layout/branch-gate'
import { PageControls } from '@/features/users/components/page-controls'
import { errorMessage, recipeApi } from './api'
import { invalidateCapturedRecipeData } from './cache'
import { RecipeSheet, type RecipeDraft } from './components/recipe-sheet'
import { RecipesModel, type RecipeSummary } from './model'

const PAGE_SIZE = 20

function scopeLabel(recipe: RecipeSummary) {
  if (recipe.scope === 'local') return t('catalog:recipes.scope.local')
  if (recipe.scope === 'customized')
    return t('catalog:recipes.scope.customized')
  return t('catalog:recipes.scope.company')
}

function activeLabel(recipe: RecipeSummary, branchMode: boolean) {
  if (!branchMode)
    return recipe.active
      ? t('catalog:common.active')
      : t('catalog:common.inactive')
  if (!recipe.sourceRecipeActive)
    return t('catalog:recipes.state.companyDisabled')
  if (recipe.scope === 'local')
    return recipe.active
      ? t('catalog:common.active')
      : t('catalog:common.inactive')
  return recipe.activation?.active
    ? t('catalog:common.active')
    : t('catalog:common.inactive')
}

function sourceLabel(recipe: RecipeSummary, branchMode: boolean) {
  if (recipe.scope === 'customized')
    return t('catalog:recipes.state.copyOfCompany', {
      version: recipe.sourceVersion ?? '—',
    })
  if (recipe.scope === 'local') return t('catalog:recipes.scope.local')
  return branchMode
    ? t('catalog:recipes.scope.company')
    : t('catalog:recipes.state.sharedToAllBranches')
}

function draftBody(draft: RecipeDraft) {
  return RecipesModel.createInput.parse({
    name: draft.name,
    code: draft.code,
    description: draft.description,
    active: draft.active,
    sellable: draft.sellable,
    sellingPrice: draft.sellingPrice,
    ingredients: draft.ingredients,
  })
}

/**
 * Company context lists the canonical company templates and the local recipes
 * of every branch of the organization, each labelled with its owning branch. A
 * branch path lists its own effective catalog: shared templates, the branch's
 * customizations and its local recipes.
 */
export function Recipes() {
  const branch = useOptionalBranch()
  return (
    <section className='space-y-6'>
      <div>
        <h2 className='text-2xl font-bold'>{t('catalog:recipes.title')}</h2>
        <p className='text-muted-foreground'>
          {branch === null
            ? t('catalog:recipes.descriptionCompany')
            : t('catalog:recipes.descriptionBranch', {
                branch: branch.branch.name,
              })}
        </p>
      </div>
      <RecipeDirectory branch={branch} />
    </section>
  )
}

/**
 * A branch-local recipe always opens inside the path of the branch that owns
 * it; a company template stays on the company path in Company context and is
 * browsed within the current branch's settings path in branch context.
 */
function RecipeDetailsLink({
  organizationSlug,
  branchUuid,
  recipe,
}: {
  organizationSlug: string
  branchUuid: string | null
  recipe: RecipeSummary
}) {
  const label = t('catalog:common.details')
  const ariaLabel = t('catalog:recipes.viewDetails', { name: recipe.name })
  const className =
    'inline-flex items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
  const owner = recipe.branch?.uuid ?? branchUuid
  return (
    <Link
      {...organizationLocation(
        organizationSlug,
        owner,
        '/settings/recipes/$recipeId',
        { recipeId: recipe.uuid }
      )}
      aria-label={ariaLabel}
      className={className}
    >
      {label}
    </Link>
  )
}

function RecipeDirectory({ branch }: { branch: BranchContext | null }) {
  const organizationSlug = useOrganizationSlug()
  const client = useQueryClient()
  const navigate = useNavigate()
  const branchUuid = branch?.branchUuid ?? null
  const branchMode = branchUuid !== null
  const scopeKey = branchCacheScope(branchUuid)
  const writable = branch === null || branch.branch.active
  const [page, setPage] = useState(0)
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [createCapture, setCreateCapture] =
    useState<CapturedBranchScope | null>(null)
  const columns = useMemo<SortableColumn<RecipeSummary>[]>(
    () => [
      {
        id: 'name',
        header: t('catalog:recipes.columns.name'),
        accessorFn: (recipe) => recipe.name,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'code',
        header: t('catalog:recipes.columns.code'),
        accessorFn: (recipe) => recipe.code ?? '',
        cell: ({ getValue }) => String(getValue() ?? '') || '—',
      },
      {
        id: 'scope',
        header: t('catalog:recipes.columns.scope'),
        accessorFn: (recipe) => scopeLabel(recipe),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      ...(branchMode
        ? []
        : [
            {
              id: 'branch',
              header: t('catalog:recipes.columns.branch'),
              accessorFn: (recipe: RecipeSummary) =>
                recipe.branch?.name ?? t('catalog:recipes.branchAll'),
              cell: ({ row }: { row: { original: RecipeSummary } }) =>
                row.original.branch?.name ?? t('catalog:recipes.branchAll'),
            } satisfies SortableColumn<RecipeSummary>,
          ]),
      {
        id: 'description',
        header: t('catalog:recipes.columns.description'),
        accessorFn: (recipe) => recipe.description,
        cell: ({ getValue }) => String(getValue() ?? '') || '—',
      },
      {
        id: 'price',
        header: t('catalog:recipes.columns.price'),
        accessorFn: (recipe) => recipe.sellingPrice ?? '',
        cell: ({ row }) =>
          row.original.sellingPrice === null
            ? '—'
            : `${row.original.sellingPrice} ${row.original.priceCurrencyCode ?? ''}`.trim(),
      },
      {
        id: 'sellable',
        header: t('catalog:recipes.columns.sellable'),
        accessorFn: (recipe) => recipe.sellable,
        cell: ({ row }) =>
          row.original.sellable
            ? t('catalog:recipes.sellableYes')
            : t('catalog:recipes.sellableNo'),
      },
      {
        id: 'ingredients',
        header: t('catalog:recipes.columns.ingredients'),
        accessorFn: (recipe) => recipe.ingredientCount,
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'active',
        header: branchMode
          ? t('catalog:recipes.columns.branchState')
          : t('catalog:recipes.columns.active'),
        accessorFn: (recipe) => activeLabel(recipe, branchMode),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'source',
        header: t('catalog:recipes.columns.source'),
        accessorFn: (recipe) => sourceLabel(recipe, branchMode),
        cell: ({ getValue }) => String(getValue() ?? ''),
      },
      {
        id: 'version',
        header: t('catalog:recipes.columns.version'),
        accessorFn: (recipe) => recipe.version,
        cell: ({ getValue }) => `v${String(getValue() ?? '')}`,
      },
      {
        id: 'updated',
        header: t('catalog:recipes.columns.updated'),
        accessorFn: (recipe) => new Date(recipe.updatedAt).getTime(),
        cell: ({ row }) =>
          new Date(row.original.updatedAt).toLocaleString(locale),
      },
      {
        id: 'actions',
        header: t('catalog:common.actions'),
        enableSorting: false,
        meta: { label: t('catalog:common.actions'), width: 110 },
        cell: ({ row }) => (
          <RecipeDetailsLink
            organizationSlug={organizationSlug}
            branchUuid={branchUuid}
            recipe={row.original}
          />
        ),
      },
    ],
    [branchMode, branchUuid, organizationSlug]
  )
  const recipes = useQuery({
    queryKey: ['recipe', scopeKey, 'list', page, search, branchUuid],
    queryFn: () =>
      recipeApi.recipes({ page, search, limit: PAGE_SIZE }, branchUuid),
  })
  const creation = useMutation({
    mutationFn: (input: {
      draft: RecipeDraft
      captured: CapturedBranchScope
    }) => recipeApi.create(draftBody(input.draft), input.captured.branchUuid),
    onSuccess: async (recipe, input) => {
      await invalidateCapturedRecipeData(client, input.captured)
      // Company creates use the company client, which a branch switch does not
      // abort. Never navigate a new branch selection to the old context.
      if (!isBranchScopeCurrent(input.captured)) return
      setCreateCapture(null)
      toast.success(
        input.captured.branchUuid === null
          ? t('catalog:recipes.toast.companyCreated')
          : t('catalog:recipes.toast.branchCreated')
      )
      const owningBranchUuid = input.captured.branchUuid
      if (owningBranchUuid === null) {
        await navigate({
          to: '/o/$organizationSlug/settings/recipes/$recipeId',
          params: { organizationSlug, recipeId: recipe.uuid },
        })
        return
      }
      await navigate({
        to: '/o/$organizationSlug/b/$branchUuid/settings/recipes/$recipeId',
        params: {
          organizationSlug,
          branchUuid: owningBranchUuid,
          recipeId: recipe.uuid,
        },
      })
    },
    onError: (caught, input) => {
      if (!isBranchScopeCurrent(input.captured)) return
      toast.error(errorMessage(caught))
    },
  })
  const data = recipes.data
  return (
    <div className='space-y-4'>
      {branch !== null && !branch.branch.active && (
        <BranchInactiveNotice branchName={branch.branch.name} />
      )}
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <form
          className='flex flex-wrap gap-2'
          onSubmit={(event) => {
            event.preventDefault()
            setPage(0)
            setSearch(draft)
          }}
        >
          <Input
            aria-label={t('catalog:recipes.searchLabel')}
            placeholder={t('catalog:recipes.searchPlaceholder')}
            maxLength={100}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className='max-w-sm'
          />
          <Button variant='outline'>{t('catalog:common.find')}</Button>
        </form>
        <Button
          type='button'
          disabled={!writable}
          onClick={() => {
            creation.reset()
            setCreateCapture(captureBranchScope(branchUuid))
          }}
        >
          {branchMode
            ? t('catalog:recipes.newLocal')
            : t('catalog:recipes.new')}
        </Button>
      </div>
      <p className='text-sm text-muted-foreground'>
        {branchMode
          ? t('catalog:recipes.branchHint')
          : t('catalog:recipes.hintCompany')}
      </p>
      {recipes.isPending && <p role='status'>{t('catalog:recipes.loading')}</p>}
      {recipes.isError && (
        <p role='alert'>
          {errorMessage(recipes.error)}{' '}
          <Button variant='outline' onClick={() => void recipes.refetch()}>
            {t('catalog:common.retry')}
          </Button>
        </p>
      )}
      {data && !recipes.isError && (
        <>
          <p className='text-sm text-muted-foreground'>
            {t('catalog:recipes.summary', {
              total: data.total.toLocaleString(locale),
              sortingNote: t('catalog:common.sortingNote'),
            })}
          </p>
          <p className='text-sm text-muted-foreground'>
            {t('catalog:recipes.openHint')}
          </p>
          <SortableDataTable
            data={data.items}
            columns={columns}
            getRowId={(recipe) => recipe.uuid}
            caption={
              branchMode
                ? t('catalog:recipes.caption')
                : t('catalog:recipes.captionCompany')
            }
            emptyMessage={
              search
                ? t('catalog:recipes.emptySearch')
                : branchMode
                  ? t('catalog:recipes.emptyBranch')
                  : t('catalog:recipes.emptyCompany')
            }
          />
        </>
      )}
      <PageControls
        page={page}
        loading={recipes.isFetching}
        hasNext={!!data && (page + 1) * data.limit < data.total}
        onChange={setPage}
      />
      {createCapture !== null && (
        <RecipeSheet
          variant='create'
          pending={creation.isPending}
          error={creation.error}
          onClose={() => {
            setCreateCapture(null)
            creation.reset()
          }}
          onSubmit={(recipeDraft) =>
            creation.mutate({ draft: recipeDraft, captured: createCapture })
          }
        />
      )}
    </div>
  )
}
