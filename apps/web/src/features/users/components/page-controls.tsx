import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

export function PageControls({
  page,
  hasNext,
  loading,
  onChange,
}: {
  page: number
  hasNext: boolean
  loading: boolean
  onChange: (page: number) => void
}) {
  return (
    <div className='flex items-center gap-3'>
      <Button
        type='button'
        variant='outline'
        disabled={page === 0 || loading}
        onClick={() => onChange(page - 1)}
      >
        {t('global:users.pageControls.previous')}
      </Button>
      <span className='text-sm'>
        {t('global:users.pageControls.page', { page: page + 1 })}
      </span>
      <Button
        type='button'
        variant='outline'
        disabled={!hasNext || loading}
        onClick={() => onChange(page + 1)}
      >
        {t('global:users.pageControls.next')}
      </Button>
    </div>
  )
}
