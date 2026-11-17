import { toast } from 'sonner'
import { t } from '@/lib/i18n'

export function showSubmittedData(
  data: unknown,
  title: string = t('common:submitted.title')
) {
  toast.message(title, {
    description: (
      <pre className='mt-2 w-full overflow-x-auto rounded-md border bg-background p-4'>
        <code className='text-foreground'>{JSON.stringify(data, null, 2)}</code>
      </pre>
    ),
  })
}
