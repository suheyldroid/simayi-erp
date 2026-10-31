import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage } from '@/features/common/api'
import { FieldInput } from '@/features/common/components/field-input'
import { currencyApi } from '../api'
import { CurrencyModel } from '../model'

export function ConverterPanel() {
  const backends = useQuery({
    queryKey: ['currency', 'backends'],
    queryFn: currencyApi.backends,
  })
  const currencies = useQuery({
    queryKey: ['currency', 'currencies'],
    queryFn: currencyApi.currencies,
  })
  const conversion = useMutation({
    mutationFn: (form: FormData) =>
      currencyApi.convert(
        CurrencyModel.conversionInput.parse(Object.fromEntries(form))
      ),
  })
  if (backends.isPending || currencies.isPending)
    return <p role='status'>Loading currency catalog…</p>
  if (backends.isError || currencies.isError)
    return (
      <div role='alert'>
        Could not load currency data.{' '}
        <Button
          variant='outline'
          onClick={() => {
            void backends.refetch()
            void currencies.refetch()
          }}
        >
          Retry
        </Button>
      </div>
    )
  if (!backends.data.length)
    return <p>Add an exchange backend in the Backends tab before converting.</p>
  const options = currencies.data.map((currency) => ({
    value: currency.code,
    label: `${currency.code} — ${currency.name}`,
  }))
  return (
    <section className='space-y-4'>
      <h2 className='text-xl font-semibold'>Decimal currency conversion</h2>
      <p className='text-sm text-muted-foreground'>
        Amounts remain decimal strings. Results round half-up to six decimal
        places. Missing or stale rates fail instead of falling back silently.
      </p>
      <form
        onChange={() => conversion.reset()}
        onSubmit={(event) => {
          event.preventDefault()
          conversion.mutate(new FormData(event.currentTarget))
        }}
      >
        <fieldset
          disabled={conversion.isPending}
          className='grid max-w-3xl gap-4 sm:grid-cols-2'
        >
          <FieldInput
            field={{
              name: 'amount',
              label: 'Amount',
              required: true,
              pattern: '-?[0-9]+(\\.[0-9]{1,6})?',
              maxLength: 100,
              defaultValue: '100.000000',
            }}
          />
          <FieldInput
            field={{
              name: 'backend',
              label: 'Exchange backend',
              type: 'select',
              required: true,
              defaultValue: backends.data[0].name,
              options: backends.data.map((backend) => ({
                value: backend.name,
                label: `${backend.name} (${backend.baseCurrency} base)`,
              })),
            }}
          />
          <FieldInput
            field={{
              name: 'from',
              label: 'From',
              type: 'select',
              required: true,
              defaultValue: 'USD',
              options,
            }}
          />
          <FieldInput
            field={{
              name: 'to',
              label: 'To',
              type: 'select',
              required: true,
              defaultValue: 'EUR',
              options,
            }}
          />
          <Button disabled={conversion.isPending}>Convert</Button>
        </fieldset>
      </form>
      {conversion.isError && (
        <p role='alert' className='text-destructive'>
          {errorMessage(conversion.error)}
        </p>
      )}
      {conversion.data && (
        <div role='status' className='space-y-2 rounded-md border p-4'>
          <p className='text-xl font-semibold'>
            {conversion.data.amount} {conversion.data.currency}
          </p>
          <p className='text-sm text-muted-foreground'>
            {conversion.data.backend} snapshot ingested{' '}
            {new Date(conversion.data.lastUpdate).toLocaleString()}
          </p>
        </div>
      )}
    </section>
  )
}
export function CurrencyCatalog() {
  const [search, setSearch] = useState('')
  const currencies = useQuery({
    queryKey: ['currency', 'currencies'],
    queryFn: currencyApi.currencies,
  })
  const term = search.toLowerCase()
  return (
    <section className='space-y-4'>
      <h2 className='text-xl font-semibold'>Currency catalog</h2>
      <Input
        aria-label='Search currencies'
        placeholder='Code or name…'
        className='max-w-sm'
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {currencies.isPending && <p role='status'>Loading currencies…</p>}
      {currencies.isError && (
        <div role='alert'>
          {errorMessage(currencies.error)}{' '}
          <Button variant='outline' onClick={() => void currencies.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {currencies.data && !currencies.isError && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currencies.data
              .filter((currency) =>
                `${currency.code} ${currency.name}`.toLowerCase().includes(term)
              )
              .map((currency) => (
                <TableRow key={currency.code}>
                  <TableCell>{currency.code}</TableCell>
                  <TableCell>{currency.name}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
