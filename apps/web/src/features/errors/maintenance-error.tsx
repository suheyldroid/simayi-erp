import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

export function MaintenanceError() {
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>503</h1>
        <span className='font-medium'>
          {t('global:errors.maintenance.title')}
        </span>
        <p className='text-center text-muted-foreground'>
          {t('global:errors.maintenance.message')}
        </p>
        <div className='mt-6 flex gap-4'>
          <Button variant='outline'>
            {t('global:errors.common.learnMore')}
          </Button>
        </div>
      </div>
    </div>
  )
}
