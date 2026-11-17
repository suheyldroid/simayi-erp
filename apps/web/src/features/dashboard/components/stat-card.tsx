import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatCount } from '../format'

/**
 * Compact count card. The value is always a real API aggregate; the caller
 * only renders it after a successful response.
 */
export function StatCard({
  label,
  value,
  description,
}: {
  label: string
  value: number
  description: string
}) {
  return (
    <Card className='gap-0 rounded-md py-0 shadow-none'>
      <CardHeader className='gap-1 px-4 pt-4'>
        <CardDescription className='text-xs font-medium tracking-wide uppercase'>
          {label}
        </CardDescription>
        <CardTitle className='text-2xl font-semibold tabular-nums'>
          {formatCount(value)}
        </CardTitle>
      </CardHeader>
      <CardContent className='px-4 pt-1 pb-4'>
        <p className='text-xs text-muted-foreground'>{description}</p>
      </CardContent>
    </Card>
  )
}
