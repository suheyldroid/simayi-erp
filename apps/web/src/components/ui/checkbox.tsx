import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { CheckIcon, MinusIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot='checkbox'
      className={cn(
        'peer inline-flex size-4.5 shrink-0 items-center justify-center rounded-none border border-input bg-background shadow-none transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 enabled:hover:border-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary/15 data-[state=indeterminate]:text-primary dark:aria-invalid:ring-destructive/40',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot='checkbox-indicator'
        className='group flex items-center justify-center text-current transition-none'
      >
        <CheckIcon className='size-3.5 group-data-[state=indeterminate]:hidden' />
        <MinusIcon className='hidden size-3.5 group-data-[state=indeterminate]:block' />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
