import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
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
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { salesApi } from './api'
import type { SaleIngredient } from './model'

const saleRoute = getRouteApi(
  '/_authenticated/o/$organizationSlug/_workspace/sales/$saleId'
)

export function SaleDetail() {
  const { saleId } = saleRoute.useParams()
  const organizationSlug = useOrganizationSlug()
  const uuid = parseResourceUuid(saleId)
  const sale = useQuery({
    queryKey: ['sales', organizationCacheScope(), 'detail', uuid],
    queryFn: () => {
      if (uuid === null) throw new Error('Sale uuid is required')
      return salesApi.get(uuid)
    },
    enabled: uuid !== null,
  })
  const detailStatus =
    sale.error && axios.isAxiosError(sale.error)
      ? sale.error.response?.status
      : undefined
  const record = sale.data
  const ingredientNames = new Map(
    (record?.ingredients ?? []).map(
      (ingredient) => [ingredient.uuid, ingredient.itemName] as const
    )
  )
  return (
    <>
      <Header fixed>
        <div className='me-auto font-medium'>Simayi ERP</div>
        <ProfileDropdown />
      </Header>
      <Main className='space-y-6'>
        <div>
          <Link
            to='/o/$organizationSlug/sales'
            params={{ organizationSlug }}
            className='rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
          >
            Back to sales
          </Link>
          <h1 className='mt-2 text-2xl font-bold'>
            {record && !sale.isError
              ? `Sale ${record.reference || record.referenceInt}`
              : 'Sale'}
          </h1>
        </div>
        {uuid === null && <p role='alert'>Sale not found.</p>}
        {uuid !== null && sale.isPending && <p role='status'>Loading sale…</p>}
        {uuid !== null && sale.isError && detailStatus === 404 && (
          <p role='alert'>Sale not found.</p>
        )}
        {uuid !== null && sale.isError && detailStatus !== 404 && (
          <p role='alert'>
            Could not load this sale.{' '}
            <Button variant='outline' onClick={() => void sale.refetch()}>
              Retry
            </Button>
          </p>
        )}
        {record && !sale.isError && (
          <>
            <section className='space-y-2 rounded-md border border-border p-4'>
              <h2 className='text-xl font-semibold'>Sale details</h2>
              <dl className='grid gap-2 text-sm sm:grid-cols-[auto_1fr]'>
                <dt>Reference</dt>
                <dd>{record.reference || record.referenceInt || '—'}</dd>
                <dt>Recipe</dt>
                <dd>{record.recipeName || '—'}</dd>
                <dt>Recipe version</dt>
                <dd>{record.recipeVersion}</dd>
                <dt>Quantity</dt>
                <dd>{record.quantity}</dd>
                <dt>Recorded</dt>
                <dd>{new Date(record.createdAt).toLocaleString()}</dd>
                <dt>Staff</dt>
                <dd>{record.createdByName}</dd>
                <dt>Ingredients</dt>
                <dd>{record.ingredientCount}</dd>
              </dl>
            </section>
            <section className='space-y-2'>
              <h2 className='text-xl font-semibold'>Ingredient snapshot</h2>
              <Table>
                <caption className='sr-only'>
                  Ingredients recorded for this sale
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead>Per recipe</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Consumed</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {record.ingredients.map((ingredient) => (
                    <IngredientRow
                      key={ingredient.uuid}
                      ingredient={ingredient}
                    />
                  ))}
                  {record.ingredients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        No ingredients were recorded.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </section>
            <section className='space-y-2'>
              <h2 className='text-xl font-semibold'>Item stock consumption</h2>
              {record.consumptions.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  No item stock was consumed for this sale.
                </p>
              ) : (
                <>
                  <Table>
                    <caption className='sr-only'>
                      Item stock consumed by this sale
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Before</TableHead>
                        <TableHead>After</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {record.consumptions.map((consumption) => (
                        <TableRow key={consumption.uuid}>
                          <TableCell>
                            {ingredientNames.get(
                              consumption.buildComponentUuid
                            ) ?? 'Ingredient'}
                          </TableCell>
                          <TableCell className='break-all'>
                            {consumption.itemUuid != null ? (
                              <Link
                                to='/o/$organizationSlug/stock/$itemId'
                                params={{
                                  organizationSlug,
                                  itemId: consumption.itemUuid,
                                }}
                                className='rounded-sm text-primary underline underline-offset-4 hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none'
                              >
                                {consumption.itemUuid}
                              </Link>
                            ) : (
                              consumption.itemUuidRef
                            )}
                          </TableCell>
                          <TableCell>{consumption.quantity}</TableCell>
                          <TableCell>{consumption.quantityBefore}</TableCell>
                          <TableCell>{consumption.quantityAfter}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </section>
          </>
        )}
      </Main>
    </>
  )
}

function IngredientRow({ ingredient }: { ingredient: SaleIngredient }) {
  return (
    <TableRow>
      <TableCell>
        {ingredient.itemName}
        {ingredient.itemIpn ? ` · ${ingredient.itemIpn}` : ''}
      </TableCell>
      <TableCell>{ingredient.quantityPerRecipe}</TableCell>
      <TableCell>{ingredient.requiredQuantity}</TableCell>
      <TableCell>{ingredient.consumedQuantity}</TableCell>
      <TableCell>{ingredient.itemUnits || '—'}</TableCell>
      <TableCell>{ingredient.note || '—'}</TableCell>
    </TableRow>
  )
}
