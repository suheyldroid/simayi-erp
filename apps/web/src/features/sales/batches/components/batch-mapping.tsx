import { useId, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { branchCacheScope } from '@/lib/branch-scope'
import { t } from '@/lib/i18n'
import { organizationCacheScope } from '@/lib/tenant'
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
} from '@/components/ui/sheet'
import {
  RecipeSelect,
  type RecipeOption,
} from '@/features/recipes/components/recipe-select'
import { salesChannelApi } from '../../api'
import { errorMessage, salesBatchesApi } from '../api'
import { batchIssueLabel } from '../issue-labels'
import type {
  BatchDetail,
  BatchPatch,
  BatchPreview,
  BatchPreviewProduct,
} from '../model'

function columnLetter(index: number) {
  let value = index + 1
  let result = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

export function BatchMapping({
  detail,
  preview,
  branchUuid,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  detail: BatchDetail
  preview: BatchPreview
  /** Branch the batch is fixed to; the product mapping picker reads it. */
  branchUuid: string
  pending: boolean
  error: unknown
  onClose: () => void
  onSubmit: (patch: BatchPatch) => void
}) {
  const dateId = useId()
  const headerId = useId()
  const newChannelId = useId()
  const client = useQueryClient()
  const scope = organizationCacheScope()
  const [businessDate, setBusinessDate] = useState(detail.businessDate)
  const [sheet, setSheet] = useState(
    detail.sheetName ?? preview.sheetNames[0] ?? ''
  )
  const [headerRow, setHeaderRow] = useState(
    detail.headerRow === null ? '1' : String(detail.headerRow)
  )
  const [channelColumn, setChannelColumn] = useState(detail.channelColumn ?? '')
  const [productColumn, setProductColumn] = useState(detail.productColumn ?? '')
  const [quantityColumn, setQuantityColumn] = useState(
    detail.quantityColumn ?? ''
  )
  const [productCodeColumn, setProductCodeColumn] = useState(
    detail.productCodeColumn ?? ''
  )
  const [channelSelections, setChannelSelections] = useState<
    Record<string, string>
  >(
    Object.fromEntries(
      preview.channels.map((channel) => [
        channel.sourceValue,
        channel.channelUuid ?? '__unmapped__',
      ])
    )
  )
  const [productSelections, setProductSelections] = useState<
    Record<string, RecipeOption | null | undefined>
  >({})
  const [newChannel, setNewChannel] = useState('')
  const [gridStart, setGridStart] = useState(0)
  const [validationError, setValidationError] = useState<string | null>(null)

  const channels = useQuery({
    queryKey: ['sales', scope, 'channels', 'list'],
    queryFn: () => salesChannelApi.list(),
  })
  const creation = useMutation({
    mutationFn: (name: string) => salesChannelApi.create(name),
    onSuccess: async () => {
      setNewChannel('')
      await client.invalidateQueries({
        queryKey: ['sales', scope, 'channels'],
      })
    },
  })
  const exploring = sheet !== '' && sheet !== detail.sheetName
  const sheetPreview = useQuery({
    queryKey: [
      'sales',
      branchCacheScope(branchUuid),
      'batches',
      'grid',
      detail.uuid,
      sheet,
      branchUuid,
    ],
    queryFn: () => salesBatchesApi.preview(branchUuid, detail.uuid, sheet),
    enabled: exploring,
  })
  const grid = exploring ? sheetPreview.data : preview

  const headerNumber = Number(headerRow)
  const headerCells = useMemo(() => {
    const row = grid?.grid.find((entry) => entry.row === headerNumber)
    return row?.cells ?? []
  }, [grid, headerNumber])
  const columnCount = useMemo(() => {
    let count = headerCells.length
    for (const entry of grid?.grid ?? []) {
      count = Math.max(count, entry.cells.length)
    }
    return count
  }, [grid, headerCells])
  const columnOptions = Array.from({ length: columnCount }, (_, index) => {
    const letter = columnLetter(index)
    const header = headerCells[index]?.trim()
    return { letter, label: header ? `${letter} — ${header}` : letter }
  })
  const showMappings = !exploring && detail.sheetName !== null

  function submit() {
    if (pending) return
    if (sheet === '') {
      setValidationError(t('operations:batches.mapping.chooseSheet'))
      return
    }
    // An empty channel column is the recognized Modpos report: every row uses
    // the single explicit source value the backend derives from the header.
    const channelLess = channelColumn === ''
    if (channelLess && grid?.modpos == null) {
      setValidationError(t('operations:batches.mapping.channelColumnRequired'))
      return
    }
    if (productColumn === '' || quantityColumn === '') {
      setValidationError(t('operations:batches.mapping.chooseColumns'))
      return
    }
    const selectedColumns = [
      channelColumn,
      productColumn,
      quantityColumn,
    ].filter((column) => column !== '')
    if (new Set(selectedColumns).size !== selectedColumns.length) {
      setValidationError(t('operations:batches.mapping.duplicateColumns'))
      return
    }
    const header = Number(headerRow)
    if (!Number.isInteger(header) || header < 1) {
      setValidationError(t('operations:batches.mapping.headerRow'))
      return
    }
    setValidationError(null)
    const channelMappings = Object.entries(channelSelections).map(
      ([sourceValue, value]) => ({
        sourceValue,
        channelUuid: value === '__unmapped__' ? null : value,
      })
    )
    const codedProductKeys = new Set(
      preview.products
        .filter((product) => product.sourceCode !== null)
        .map((product) => product.productKey)
    )
    const productMappings = Object.entries(productSelections).flatMap(
      ([productKey, selection]) =>
        selection === undefined || codedProductKeys.has(productKey)
          ? []
          : [
              {
                productKey,
                recipeUuid: selection === null ? null : selection.uuid,
              },
            ]
    )
    onSubmit({
      businessDate,
      sheet: {
        sheetName: sheet,
        headerRow: header,
        channelColumn: channelLess ? null : channelColumn,
        productColumn,
        quantityColumn,
        productCodeColumn: productCodeColumn === '' ? null : productCodeColumn,
      },
      ...(showMappings ? { channelMappings, productMappings } : {}),
    })
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <SheetContent className='flex w-full flex-col gap-0 sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>
            {t('operations:batches.mapping.title', {
              branch: detail.branch.name,
            })}
          </SheetTitle>
          <SheetDescription>
            {t('operations:batches.mapping.description')}
          </SheetDescription>
        </SheetHeader>
        <form
          className='flex min-h-0 flex-1 flex-col'
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className='flex-1 space-y-6 overflow-y-auto px-4 pb-4'>
            <fieldset disabled={pending} className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor={dateId}>
                  {t('operations:batches.mapping.businessDate')}
                </Label>
                <Input
                  id={dateId}
                  type='date'
                  required
                  value={businessDate}
                  onChange={(event) => setBusinessDate(event.target.value)}
                />
                <p className='text-xs text-muted-foreground'>
                  {t('operations:batches.mapping.businessDateHint')}
                </p>
              </div>
              <div className='space-y-2'>
                <Label htmlFor={headerId}>
                  {t('operations:batches.mapping.headerRow')}
                </Label>
                <Input
                  id={headerId}
                  type='number'
                  min={1}
                  step={1}
                  required
                  value={headerRow}
                  onChange={(event) => setHeaderRow(event.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label>{t('operations:batches.mapping.worksheet')}</Label>
                <Select
                  value={sheet || undefined}
                  onValueChange={(value) => {
                    setGridStart(0)
                    setSheet(value)
                  }}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue
                      placeholder={t('operations:batches.mapping.chooseSheet')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {detail.sheetNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ColumnSelect
                label={t('operations:batches.mapping.channelColumn')}
                value={channelColumn}
                options={columnOptions}
                allowNone={grid?.modpos != null}
                noneLabel={t('operations:batches.mapping.noChannelColumn')}
                onChange={setChannelColumn}
              />
              <ColumnSelect
                label={t('operations:batches.mapping.productColumn')}
                value={productColumn}
                options={columnOptions}
                onChange={setProductColumn}
              />
              <ColumnSelect
                label={t('operations:batches.mapping.quantityColumn')}
                value={quantityColumn}
                options={columnOptions}
                onChange={setQuantityColumn}
              />
              <ColumnSelect
                label={t('operations:batches.mapping.productCodeColumn')}
                value={productCodeColumn}
                options={columnOptions}
                allowNone
                onChange={setProductCodeColumn}
              />
            </fieldset>

            {channelColumn === '' && grid?.modpos != null && (
              <section className='space-y-2 rounded-md border border-border p-3'>
                <h3 className='font-medium'>
                  {t('operations:batches.mapping.modposTitle')}
                </h3>
                <p className='text-xs text-muted-foreground'>
                  {t('operations:batches.mapping.modposDescription', {
                    sheet: grid.modpos.sheetName,
                    headerRow: grid.modpos.headerRow,
                  })}
                </p>
                <ul className='list-disc space-y-1 ps-5 text-xs text-muted-foreground'>
                  {grid.modpos.notes.map((note) => (
                    <li key={note.code}>{batchIssueLabel(note)}</li>
                  ))}
                </ul>
              </section>
            )}

            {exploring && sheetPreview.isPending && (
              <p role='status'>
                {t('operations:batches.mapping.loadingPreview')}
              </p>
            )}
            {exploring && sheetPreview.isError && (
              <p role='alert'>
                {errorMessage(sheetPreview.error)}{' '}
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => void sheetPreview.refetch()}
                >
                  {t('operations:common.retry')}
                </Button>
              </p>
            )}
            {grid && grid.grid.length > 0 && (
              <div className='space-y-2'>
                <h3 className='font-medium'>
                  {t('operations:batches.mapping.worksheetPreview')}
                </h3>
                <p className='text-xs text-muted-foreground'>
                  {grid.gridTruncated
                    ? t('operations:batches.mapping.gridTruncated')
                    : t('operations:batches.mapping.gridHint')}
                </p>
                <div className='max-h-52 overflow-auto rounded-md border border-border'>
                  <table className='w-full text-left text-xs'>
                    <caption className='sr-only'>
                      {t('operations:batches.mapping.gridCaption')}
                    </caption>
                    <tbody>
                      {grid.grid.slice(gridStart, gridStart + 25).map((row) => (
                        <tr key={row.row} className='border-b border-border'>
                          <th
                            scope='row'
                            className='sticky start-0 bg-background px-2 py-1 text-muted-foreground'
                          >
                            {row.row}
                          </th>
                          {row.cells.map((cell, index) => (
                            <td key={index} className='px-2 py-1'>
                              {cell || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className='flex items-center gap-2 text-xs'>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={gridStart === 0}
                    onClick={() =>
                      setGridStart((start) => Math.max(0, start - 25))
                    }
                  >
                    {t('operations:batches.mapping.previousRows')}
                  </Button>
                  <span>
                    {t('operations:batches.mapping.rowRange', {
                      from: gridStart + 1,
                      to: Math.min(gridStart + 25, grid.grid.length),
                      total: grid.grid.length,
                      more: grid.gridTruncated
                        ? t('operations:batches.mapping.moreRows')
                        : '',
                    })}
                  </span>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={gridStart + 25 >= grid.grid.length}
                    onClick={() => setGridStart((start) => start + 25)}
                  >
                    {t('operations:batches.mapping.nextRows')}
                  </Button>
                </div>
              </div>
            )}

            {showMappings && (
              <>
                <section className='space-y-3'>
                  <h3 className='font-medium'>
                    {t('operations:batches.mapping.channelMapping')}
                  </h3>
                  {preview.channels.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      {t('operations:batches.mapping.channelMappingEmpty')}
                    </p>
                  ) : (
                    <div className='space-y-2'>
                      {preview.channels.map((source) => (
                        <div
                          key={source.sourceValue}
                          className='flex flex-wrap items-center gap-2'
                        >
                          <span className='min-w-0 flex-1 truncate text-sm'>
                            {source.sourceValue}
                            <span className='text-muted-foreground'>
                              {' '}
                              {t('operations:batches.mapping.channelStats', {
                                rows: source.rows,
                                quantity: source.quantity,
                              })}
                            </span>
                          </span>
                          <Select
                            value={
                              channelSelections[source.sourceValue] || undefined
                            }
                            onValueChange={(value) =>
                              setChannelSelections((current) => ({
                                ...current,
                                [source.sourceValue]: value,
                              }))
                            }
                          >
                            <SelectTrigger className='w-56'>
                              <SelectValue
                                placeholder={t(
                                  'operations:batches.mapping.chooseChannel'
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='__unmapped__'>
                                {t('operations:batches.mapping.unmapped')}
                              </SelectItem>
                              {(channels.data?.items ?? [])
                                .filter((channel) => channel.active)
                                .map((channel) => (
                                  <SelectItem
                                    key={channel.uuid}
                                    value={channel.uuid}
                                  >
                                    {channel.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className='flex items-end gap-2'>
                    <div className='min-w-0 flex-1 space-y-1'>
                      <Label htmlFor={newChannelId} className='text-xs'>
                        {t('operations:batches.mapping.newChannel')}
                      </Label>
                      <Input
                        id={newChannelId}
                        value={newChannel}
                        onChange={(event) => setNewChannel(event.target.value)}
                        maxLength={100}
                        disabled={pending || creation.isPending}
                      />
                    </div>
                    <Button
                      type='button'
                      variant='outline'
                      disabled={
                        pending ||
                        creation.isPending ||
                        newChannel.trim() === ''
                      }
                      onClick={() => creation.mutate(newChannel.trim())}
                    >
                      {t('operations:batches.mapping.addChannel')}
                    </Button>
                  </div>
                  {creation.isError && (
                    <p role='alert' className='text-sm text-destructive'>
                      {errorMessage(creation.error)}
                    </p>
                  )}
                </section>

                <section className='space-y-2'>
                  <h3 className='font-medium'>
                    {t('operations:batches.mapping.productMapping')}
                  </h3>
                  {preview.products.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      {t('operations:batches.mapping.productMappingEmpty')}
                    </p>
                  ) : (
                    <div className='space-y-3'>
                      {preview.products.map((product) => (
                        <ProductMappingRow
                          key={product.productKey}
                          product={product}
                          branchUuid={branchUuid}
                          value={productSelections[product.productKey]}
                          disabled={pending}
                          onChange={(next) =>
                            setProductSelections((current) => ({
                              ...current,
                              [product.productKey]: next,
                            }))
                          }
                        />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {(validationError != null || error != null) && (
              <p role='alert' className='text-destructive'>
                {validationError ?? errorMessage(error)}
              </p>
            )}
          </div>
          <SheetFooter className='border-t'>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              disabled={pending}
            >
              {t('operations:common.cancel')}
            </Button>
            <Button
              type='submit'
              disabled={pending || (exploring && sheetPreview.isPending)}
            >
              {t('operations:batches.mapping.save')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function ColumnSelect({
  label,
  value,
  options,
  allowNone = false,
  noneLabel,
  onChange,
}: {
  label: string
  value: string
  options: { letter: string; label: string }[]
  allowNone?: boolean
  noneLabel?: string
  onChange: (value: string) => void
}) {
  return (
    <div className='space-y-2'>
      <Label>{label}</Label>
      <Select
        value={value === '' ? (allowNone ? '__none__' : undefined) : value}
        onValueChange={(next) => onChange(next === '__none__' ? '' : next)}
      >
        <SelectTrigger className='w-full'>
          <SelectValue
            placeholder={t('operations:batches.mapping.chooseColumn')}
          />
        </SelectTrigger>
        <SelectContent>
          {allowNone && (
            <SelectItem value='__none__'>
              {noneLabel ?? t('operations:batches.mapping.none')}
            </SelectItem>
          )}
          {options.map((option) => (
            <SelectItem key={option.letter} value={option.letter}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ProductMappingRow({
  product,
  branchUuid,
  value,
  disabled,
  onChange,
}: {
  product: BatchPreviewProduct
  /** Batch branch: the backend only accepts its effective active recipes. */
  branchUuid: string
  value: RecipeOption | null | undefined
  disabled: boolean
  onChange: (next: RecipeOption | null) => void
}) {
  const coded = product.sourceCode !== null
  return (
    <div className='space-y-2 rounded-md border border-border p-3'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <p className='text-sm font-medium'>
          {product.label || product.productKey}
        </p>
        <p className='text-xs text-muted-foreground'>
          {t('operations:batches.mapping.productStats', {
            rows: product.rows,
            quantity: product.quantity,
            current:
              !coded && product.recipeName
                ? t('operations:batches.mapping.productCurrent', {
                    recipe: product.recipeName,
                  })
                : '',
          })}
        </p>
      </div>
      {coded ? (
        <div className='space-y-1'>
          <p className='text-sm'>
            <span className='text-muted-foreground'>
              {t('operations:batches.mapping.sourceCode')}
            </span>{' '}
            {product.sourceCode}
          </p>
          <p className='text-sm'>
            {product.recipeName === null
              ? t('operations:batches.mapping.codedUnmatched')
              : t('operations:batches.mapping.codedMatched', {
                  recipe: product.recipeName,
                })}
          </p>
          <p className='text-xs text-muted-foreground'>
            {t('operations:batches.mapping.codedInstruction')}
          </p>
        </div>
      ) : (
        <>
          <RecipeSelect
            label={t('operations:batches.mapping.recipeFor', {
              product: product.label || product.productKey,
            })}
            branchUuid={branchUuid}
            value={value === undefined ? null : value}
            disabled={disabled}
            sellableOnly
            onChange={onChange}
          />
          {value !== undefined && (
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={disabled}
              onClick={() => onChange(null)}
            >
              {t('operations:batches.mapping.clearMapping')}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
