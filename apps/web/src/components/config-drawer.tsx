import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

/**
 * Header layout panel. The shell layout is fixed, so this is a read-only
 * summary of the values in effect rather than a preference editor: no
 * selection, no reset and nothing persisted. Only the open/close state of the
 * sheet itself is local and ephemeral. The trigger stays in the header so the
 * current layout is always explainable from every shell.
 */
export function ConfigDrawer() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size='icon' variant='ghost' aria-label='Open layout settings'>
          <Settings aria-hidden='true' />
        </Button>
      </SheetTrigger>
      <SheetContent className='flex flex-col'>
        <SheetHeader className='pb-0 text-start'>
          <SheetTitle>Layout</SheetTitle>
          <SheetDescription>
            The application layout is fixed. These are the settings in effect
            for every screen.
          </SheetDescription>
        </SheetHeader>
        <dl className='space-y-4 overflow-y-auto px-4 text-sm'>
          <LayoutFact
            label='Sidebar style'
            value='Sidebar'
            description='The standard sidebar variant is always used; it is never inset or floating.'
          />
          <LayoutFact
            label='Layout'
            value='Default'
            description='The sidebar starts expanded whenever a shell mounts. Collapsing it lasts until that shell unmounts and is never saved.'
          />
          <LayoutFact
            label='Direction'
            value='Left to right'
            description='The document direction is fixed to left-to-right. Right-to-left is not available.'
          />
        </dl>
      </SheetContent>
    </Sheet>
  )
}

function LayoutFact({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description: string
}) {
  return (
    <div className='space-y-1 border-b border-border pb-4 last:border-b-0 last:pb-0'>
      <dt className='font-semibold text-muted-foreground'>{label}</dt>
      <dd>
        <span className='block text-foreground'>{value}</span>
        <span className='mt-1 block text-xs text-muted-foreground'>
          {description}
        </span>
      </dd>
    </div>
  )
}
