import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type TooltipIconButtonProps = Omit<
  ComponentProps<typeof Button>,
  'children' | 'size' | 'variant'
> & {
  label: string
  tooltip: string
  children: ReactNode
}

/**
 * Icon-only action with a real Radix tooltip. A disabled button cannot receive
 * pointer or keyboard focus, so it is wrapped in a focusable span that still
 * opens the tooltip; the label also states that the action is unavailable.
 */
export function TooltipIconButton({
  label,
  tooltip,
  children,
  className,
  disabled,
  ...props
}: TooltipIconButtonProps) {
  const button = (
    <Button
      type='button'
      size='icon'
      variant='ghost'
      className={cn(
        'size-8 shrink-0 text-muted-foreground hover:text-foreground',
        className
      )}
      {...props}
      disabled={disabled}
      aria-label={label}
    >
      {children}
    </Button>
  )

  if (!disabled)
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    )

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`${label} (unavailable)`}
          className='inline-flex rounded-md'
        >
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip} Unavailable right now.</TooltipContent>
    </Tooltip>
  )
}
