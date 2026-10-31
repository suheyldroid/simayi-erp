import { ZodError } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { type EffectivePermissions } from '@/features/users/access-model'
import { commonApi, errorMessage } from '../api'
import { CommonModel } from '../model'
import { FieldInput } from './field-input'
import { ResourcePanel } from './resource-panel'

const text = (form: FormData, key: string) => String(form.get(key) ?? '')
function parseProject(form: FormData) {
  try {
    return CommonModel.projectBody.parse({
      code: text(form, 'code'),
      description: text(form, 'description'),
      active: form.has('active'),
      responsibleId: text(form, 'responsibleId')
        ? Number(text(form, 'responsibleId'))
        : null,
      metadata: text(form, 'metadata').trim()
        ? JSON.parse(text(form, 'metadata'))
        : null,
    })
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new ZodError([
        {
          code: 'custom',
          path: ['metadata'],
          message: 'Enter a valid JSON object.',
        },
      ])
    throw error
  }
}

export function ProjectsPanel({
  effective,
}: {
  effective: EffectivePermissions
}) {
  return (
    <ResourcePanel
      resource='projects'
      title='Project codes'
      description='Owner checks apply to stored projects. Find responsible Owner IDs under Users → Ownership.'
      effective={effective}
      headers={['ID', 'Code', 'Description', 'Active', 'Responsible owner']}
      cells={(row) => [
        row.id,
        row.code,
        row.description,
        row.active ? 'Yes' : 'No',
        row.responsibleId ?? 'Unassigned',
      ]}
      fields={[
        { name: 'code', label: 'Code', required: true, maxLength: 50 },
        { name: 'description', label: 'Description', maxLength: 200 },
        {
          name: 'active',
          label: 'Active',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'responsibleId',
          label: 'Responsible Owner ID (optional)',
          type: 'number',
          min: 1,
          max: 2147483647,
        },
        {
          name: 'metadata',
          label: 'Metadata (JSON object, optional)',
          type: 'textarea',
          value: (row) =>
            row.metadata ? JSON.stringify(row.metadata, null, 2) : '',
        },
      ]}
      list={commonApi.projects}
      save={commonApi.saveProject}
      remove={(id) => commonApi.remove('projects', id)}
      parse={parseProject}
    />
  )
}
export function UnitsPanel({ effective }: { effective: EffectivePermissions }) {
  const units = useQuery({
    queryKey: ['common', 'unit-builtins'],
    queryFn: () => commonApi.units(),
  })
  const conversion = useMutation({ mutationFn: commonApi.convert })
  return (
    <div className='space-y-6'>
      <ResourcePanel
        resource='units'
        title='Physical units'
        description='Definition: 1, an alias such as kg, or a positive scalar such as 1000 mm. Compound expressions are not supported.'
        effective={effective}
        headers={['ID', 'Name', 'Symbol', 'Definition']}
        cells={(row) => [row.id, row.name, row.symbol, row.definition]}
        fields={[
          {
            name: 'name',
            label: 'Name',
            required: true,
            maxLength: 50,
            pattern: '[A-Za-z][A-Za-z0-9_]*',
          },
          { name: 'symbol', label: 'Symbol', maxLength: 10 },
          {
            name: 'definition',
            label: 'Definition',
            required: true,
            maxLength: 50,
          },
        ]}
        list={commonApi.units}
        save={commonApi.saveUnit}
        remove={(id) => commonApi.remove('units', id)}
        parse={(form) => CommonModel.unitBody.parse(Object.fromEntries(form))}
      />
      {units.data && (
        <p className='text-sm text-muted-foreground'>
          Built-in units:{' '}
          {units.data.builtins
            .map((unit) => `${unit.name} (${unit.dimension})`)
            .join(', ')}
        </p>
      )}
      <section className='space-y-3 rounded-md border p-4'>
        <h2 className='font-semibold'>Unit conversion</h2>
        <form
          className='space-y-3'
          onChange={() => conversion.reset()}
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            conversion.mutate({
              amount: text(data, 'amount'),
              from: text(data, 'from'),
              to: text(data, 'to'),
            })
          }}
        >
          <fieldset
            disabled={conversion.isPending}
            className='grid gap-3 sm:grid-cols-3'
          >
            <FieldInput
              field={{
                name: 'amount',
                label: 'Amount (decimal string)',
                required: true,
                pattern: '-?[0-9]+(\\.[0-9]{1,6})?',
                defaultValue: '1',
                maxLength: 100,
              }}
            />
            <FieldInput
              field={{
                name: 'from',
                label: 'From',
                required: true,
                defaultValue: 'kg',
                maxLength: 50,
              }}
            />
            <FieldInput
              field={{
                name: 'to',
                label: 'To',
                required: true,
                defaultValue: 'g',
                maxLength: 50,
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
          <p role='status'>Result: {conversion.data.amount}</p>
        )}
      </section>
    </div>
  )
}
export function StatusesPanel({
  effective,
}: {
  effective: EffectivePermissions
}) {
  const catalog = useQuery({
    queryKey: ['common', 'status-catalog'],
    queryFn: commonApi.catalog,
  })
  const models = useQuery({
    queryKey: ['common', 'all-model-types'],
    queryFn: commonApi.allModelTypes,
  })
  if (catalog.isPending || models.isPending)
    return <p role='status'>Loading status definitions…</p>
  if (catalog.isError || models.isError)
    return (
      <div role='alert'>
        Could not load status definitions.{' '}
        <Button
          variant='outline'
          onClick={() => {
            void catalog.refetch()
            void models.refetch()
          }}
        >
          Retry
        </Button>
      </div>
    )
  return (
    <div className='space-y-5'>
      <ResourcePanel
        resource='statuses'
        title='Custom statuses'
        description='Select the matching model and reference status. A custom status changes presentation, not workflow rules. Model, reference, and key cannot change after creation.'
        effective={effective}
        headers={[
          'ID',
          'Reference',
          'Key',
          'Logical key',
          'Name',
          'Label',
          'Color',
          'Model ID',
        ]}
        cells={(row) => [
          row.id,
          row.referenceStatus,
          row.key,
          row.logicalKey,
          row.name,
          row.label,
          row.color,
          row.modelId,
        ]}
        fields={[
          {
            name: 'referenceStatus',
            label: 'Reference status',
            type: 'select',
            required: true,
            immutable: true,
            options: catalog.data.map((entry) => ({
              value: entry.referenceStatus,
              label: entry.referenceStatus,
            })),
          },
          {
            name: 'modelId',
            label: 'Model type',
            type: 'select',
            required: true,
            immutable: true,
            options: models.data.map((entry) => ({
              value: String(entry.id),
              label: `${entry.appLabel}.${entry.model} (#${entry.id})`,
            })),
          },
          {
            name: 'key',
            label: 'Custom key (must not match a built-in key)',
            type: 'number',
            required: true,
            min: 1,
            max: 2147483647,
            immutable: true,
          },
          {
            name: 'logicalKey',
            label: 'Built-in logical key',
            type: 'number',
            required: true,
            min: 1,
            max: 2147483647,
          },
          {
            name: 'name',
            label: 'Name (UPPER_CASE)',
            required: true,
            pattern: '[A-Z_][A-Z0-9_]*',
            maxLength: 250,
          },
          { name: 'label', label: 'Label', required: true, maxLength: 250 },
          {
            name: 'color',
            label: 'Color',
            type: 'select',
            required: true,
            defaultValue: 'secondary',
            options: [
              'primary',
              'secondary',
              'success',
              'warning',
              'danger',
              'info',
              'dark',
            ].map((color) => ({ value: color, label: color })),
          },
        ]}
        list={commonApi.statuses}
        save={commonApi.saveStatus}
        remove={(id) => commonApi.remove('statuses', id)}
        parse={(form) =>
          CommonModel.statusBody.parse({
            ...Object.fromEntries(form),
            modelId: Number(text(form, 'modelId')),
            key: Number(text(form, 'key')),
            logicalKey: Number(text(form, 'logicalKey')),
          })
        }
      />
      <details className='rounded-md border p-4'>
        <summary className='cursor-pointer font-medium'>
          Built-in logical keys
        </summary>
        <ul className='mt-3 space-y-2 text-sm'>
          {catalog.data.map((entry) => (
            <li key={entry.referenceStatus}>
              <strong>{entry.referenceStatus}</strong> — {entry.appLabel}.
              {entry.model}:{' '}
              {Object.entries(entry.values)
                .map(([name, key]) => `${name}=${key}`)
                .join(', ')}
            </li>
          ))}
        </ul>
      </details>
    </div>
  )
}
export function ModelTypesPanel({
  effective,
}: {
  effective: EffectivePermissions
}) {
  return (
    <ResourcePanel
      resource='model-types'
      title='Model types'
      description='Read-only registry. A registered type does not prove that a business record exists.'
      effective={effective}
      headers={['ID', 'Application', 'Model']}
      cells={(row) => [row.id, row.appLabel, row.model]}
      list={commonApi.modelTypes}
    />
  )
}
