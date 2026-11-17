import { type CSSProperties } from 'react'
import { Toaster as Sonner, ToasterProps } from 'sonner'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Toast viewport. The design system is dark only, so the theme is fixed here and
 * every surface binds to the semantic CSS variables instead of Sonner's own
 * light/dark palette. Sonner's bundled stylesheet hardcodes an 8px toast radius
 * plus 4px/50% button radii, so those are bound to the shared radius token and
 * squared through the supported style/classNames hooks.
 */
export function Toaster({
  toastOptions,
  className,
  style,
  ...props
}: ToasterProps) {
  return (
    <Sonner
      {...props}
      theme='dark'
      className={cn('toaster group [&_div[data-content]]:w-full', className)}
      toastOptions={{
        closeButtonAriaLabel: t('common:a11y.closeToast'),
        ...toastOptions,
        actionButtonStyle: {
          borderRadius: 'var(--radius)',
          ...toastOptions?.actionButtonStyle,
        },
        cancelButtonStyle: {
          borderRadius: 'var(--radius)',
          ...toastOptions?.cancelButtonStyle,
        },
        classNames: {
          ...toastOptions?.classNames,
          closeButton: cn(
            'rounded-none!',
            toastOptions?.classNames?.closeButton
          ),
        },
      }}
      style={
        {
          '--border-radius': 'var(--radius)',
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          ...style,
        } as CSSProperties
      }
    />
  )
}
