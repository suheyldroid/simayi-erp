import { useId, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  pending,
  error,
  onClose,
  onSubmit,
}: {
  detail: BatchDetail
  preview: BatchPreview
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
    queryKey: ['sales', scope, 'batches', 'grid', detail.uuid, sheet],
    queryFn: () => salesBatchesApi.preview(detail.uuid, sheet),
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
      setValidationError('Choose a worksheet')
      return
    }
    if (channelColumn === '' || productColumn === '' || quantityColumn === '') {
      setValidationError('Choose the channel, product and quantity columns')
      return
    }
    if (
      channelColumn === productColumn ||
      channelColumn === quantityColumn ||
      productColumn === quantityColumn
    ) {
      setValidationError(
        'Channel, product and quantity must use different columns'
      )
      return
    }
    const header = Number(headerRow)
    if (!Number.isInteger(header) || header < 1) {
      setValidationError('Header row must be a positive whole number')
      return
    }
    setValidationError(null)
    const channelMappings = Object.entries(channelSelections).map(
      ([sourceValue, value]) => ({
        sourceValue,
        channelUuid: value === '__unmapped__' ? null : value,
      })
    )
    const productMappings = Object.entries(productSelections).flatMap(
      ([productKey, selection]) =>
        selection === undefined
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
        channelColumn,
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
          <SheetTitle>Configure sales batch</SheetTitle>
          <SheetDescription>
            Select the worksheet, header row and the actual source columns for
            channel, product and quantity. Nothing is guessed: totals and other
            non-sale rows are excluded explicitly from the preview table, and
            every channel and product must be mapped here before processing.
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
                <Label htmlFor={dateId}>Sale date</Label>
                <Input
                  id={dateId}
                  type='date'
                  required
                  value={businessDate}
                  onChange={(event) => setBusinessDate(event.target.value)}
                />
                <p className='text-xs text-muted-foreground'>
                  Calendar business date, independent of the upload time.
                </p>
              </div>
              <div className='space-y-2'>
                <Label htmlFor={headerId}>Header row</Label>
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
                <Label>Worksheet</Label>
                <Select
                  value={sheet || undefined}
                  onValueChange={(value) => {
                    setGridStart(0)
                    setSheet(value)
                  }}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Choose a worksheet' />
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
                label='Channel column'
                value={channelColumn}
                options={columnOptions}
                onChange={setChannelColumn}
              />
              <ColumnSelect
                label='Product column'
                value={productColumn}
                options={columnOptions}
                onChange={setProductColumn}
              />
              <ColumnSelect
                label='Quantity column'
                value={quantityColumn}
                options={columnOptions}
                onChange={setQuantityColumn}
              />
              <ColumnSelect
                label='Product code column (optional)'
                value={productCodeColumn}
                options={columnOptions}
                allowNone
                onChange={setProductCodeColumn}
              />
            </fieldset>

            {exploring && sheetPreview.isPending && (
              <p role='status'>Loading worksheet preview…</p>
            )}
            {exploring && sheetPreview.isError && (
              <p role='alert'>
                {errorMessage(sheetPreview.error)}{' '}
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => void sheetPreview.refetch()}
                >
                  Retry
                </Button>
              </p>
            )}
            {grid && grid.grid.length > 0 && (
              <div className='space-y-2'>
                <h3 className='font-medium'>Worksheet preview</h3>
                <p className='text-xs text-muted-foreground'>
                  {grid.gridTruncated
                    ? 'Showing the first rows only; use the preview table for the full row analysis.'
                    : 'Choose a column by its letter and visible header text.'}
                </p>
                <div className='max-h-52 overflow-auto rounded-md border border-border'>
                  <table className='w-full text-left text-xs'>
                    <caption className='sr-only'>Raw worksheet cells</caption>
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
                    Previous rows
                  </Button>
                  <span>
                    Rows {gridStart + 1}–
                    {Math.min(gridStart + 25, grid.grid.length)} of{' '}
                    {grid.grid.length}
                    {grid.gridTruncated ? ' (more rows exist)' : ''}
                  </span>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={gridStart + 25 >= grid.grid.length}
                    onClick={() => setGridStart((start) => start + 25)}
                  >
                    Next rows
                  </Button>
                </div>
              </div>
            )}

            {showMappings && (
              <>
                <section className='space-y-3'>
                  <h3 className='font-medium'>Channel mapping</h3>
                  {preview.channels.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      Save the worksheet and columns once to list the channels
                      found in the report.
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
                              · {source.rows} rows · {source.quantity} qty
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
                              <SelectValue placeholder='Choose channel' />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value='__unmapped__'>
                                Unmapped
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
                        New channel
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
                      Add channel
                    </Button>
                  </div>
                  {creation.isError && (
                    <p role='alert' className='text-sm text-destructive'>
                      {errorMessage(creation.error)}
                    </p>
                  )}
                </section>

                <section className='space-y-2'>
                  <h3 className='font-medium'>Product mapping</h3>
                  {preview.products.length === 0 ? (
                    <p className='text-sm text-muted-foreground'>
                      No product values were found with the saved columns.
                    </p>
                  ) : (
                    <div className='space-y-3'>
                      {preview.products.map((product) => (
                        <ProductMappingRow
                          key={product.productKey}
                          product={product}
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
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={pending || (exploring && sheetPreview.isPending)}
            >
              Save configuration
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
  onChange,
}: {
  label: string
  value: string
  options: { letter: string; label: string }[]
  allowNone?: boolean
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
          <SelectValue placeholder='Choose a column' />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value='__none__'>None</SelectItem>}
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
  value,
  disabled,
  onChange,
}: {
  product: BatchPreviewProduct
  value: RecipeOption | null | undefined
  disabled: boolean
  onChange: (next: RecipeOption | null) => void
}) {
  return (
    <div className='space-y-2 rounded-md border border-border p-3'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <p className='text-sm font-medium'>
          {product.label || product.productKey}
        </p>
        <p className='text-xs text-muted-foreground'>
          {product.rows} rows · {product.quantity} qty
          {product.recipeName ? ` · current: ${product.recipeName}` : ''}
        </p>
      </div>
      <RecipeSelect
        label={`Recipe for ${product.label || product.productKey}`}
        value={value === undefined ? null : value}
        disabled={disabled}
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
          Clear mapping
        </Button>
      )}
    </div>
  )
}
