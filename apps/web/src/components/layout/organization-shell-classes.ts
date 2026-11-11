import { cn } from '@/lib/utils'

/**
 * Shared content container styles for the sibling organization shells, so
 * container queries and fixed-layout heights behave identically in both. The
 * shell variant is fixed to `sidebar`, so no inset margin compensation applies.
 */
export const organizationShellContentClassName = cn(
  // Set content container, so we can use container queries
  '@container/content',

  // The shell layout is fixed: a fixed page height keeps the scrollable main
  // area inside the viewport instead of overflowing.
  'has-data-[layout=fixed]:h-svh'
)
