import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { commonApi, errorMessage } from '../api'
import { type Setting } from '../model'
import { FieldInput } from './field-input'

function SettingEditor({
  setting,
  personal,
  canEdit,
}: {
  setting: Setting
  personal: boolean
  canEdit: boolean
}) {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ value, reset }: { value?: string; reset?: boolean }) =>
      reset
        ? commonApi.resetSetting(personal, setting.key)
        : commonApi.saveSetting(personal, setting.key, value ?? ''),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ['common', 'settings', personal],
      })
      toast.success('Setting saved.')
    },
  })
  const choices =
    setting.key === 'CURRENCY_UPDATE_PLUGIN'
      ? ['frankfurter', 'manual']
      : setting.key === 'DATE_DISPLAY_FORMAT'
        ? ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY']
        : undefined
  return (
    <form
      className='space-y-3 rounded-md border p-4'
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        mutation.mutate({
          value:
            setting.type === 'boolean'
              ? String(data.has('value'))
              : String(data.get('value') ?? ''),
        })
      }}
    >
      <fieldset disabled={!canEdit || mutation.isPending} className='space-y-3'>
        <FieldInput
          field={{
            name: 'value',
            label: setting.key,
            type: choices
              ? 'select'
              : setting.type === 'boolean'
                ? 'checkbox'
                : setting.type === 'integer'
                  ? 'number'
                  : 'text',
            options: choices?.map((value) => ({ value, label: value })),
            maxLength: 2000,
            pattern: setting.type === 'currency' ? '[A-Z]{3}' : undefined,
          }}
          value={setting.value}
        />
        <p className='text-xs text-muted-foreground'>
          Default: {setting.defaultValue || '(empty)'}
        </p>
        {canEdit && (
          <div className='flex gap-2'>
            <Button disabled={mutation.isPending}>Save</Button>
            <Button
              type='button'
              variant='outline'
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ reset: true })}
            >
              Restore default
            </Button>
          </div>
        )}
      </fieldset>
      {mutation.isError && (
        <p role='alert' className='text-destructive'>
          {errorMessage(mutation.error)}
        </p>
      )}
    </form>
  )
}
export function SettingsPanel({
  personal,
  canEdit,
}: {
  personal: boolean
  canEdit: boolean
}) {
  const settings = useQuery({
    queryKey: ['common', 'settings', personal],
    queryFn: () => commonApi.settings(personal),
  })
  return (
    <section className='space-y-4'>
      <h2 className='text-xl font-semibold'>
        {personal ? 'My preferences' : 'System settings'}
      </h2>
      <p className='text-sm text-muted-foreground'>
        {personal
          ? 'These values belong only to your signed-in account.'
          : 'Currency update interval is in hours. Changes apply to the automatic refresh worker without restarting.'}
      </p>
      {settings.isPending && <p role='status'>Loading settings…</p>}
      {settings.isError && (
        <div role='alert'>
          {errorMessage(settings.error)}{' '}
          <Button variant='outline' onClick={() => void settings.refetch()}>
            Retry
          </Button>
        </div>
      )}
      {settings.data && !settings.isError && (
        <div className='grid gap-4 md:grid-cols-2'>
          {settings.data.map((setting) => (
            <SettingEditor
              key={`${setting.key}:${setting.value}`}
              setting={setting}
              personal={personal}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </section>
  )
}
