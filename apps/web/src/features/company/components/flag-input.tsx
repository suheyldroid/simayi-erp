import { useId } from 'react'
import { Label } from '@/components/ui/label'

export function FlagInput({
  name,
  label,
  defaultChecked = false,
  checked,
  disabled = false,
  onChange,
}: {
  name: string
  label: string
  defaultChecked?: boolean
  checked?: boolean
  disabled?: boolean
  onChange?: (checked: boolean) => void
}) {
  const id = useId()
  const controlled = checked !== undefined
  return (
    <div className='flex items-center gap-2'>
      <input
        id={id}
        type='checkbox'
        name={name}
        defaultChecked={controlled ? undefined : defaultChecked}
        checked={controlled ? checked : undefined}
        disabled={disabled}
        onChange={
          onChange
            ? (event) => onChange(event.currentTarget.checked)
            : undefined
        }
        className='size-4 rounded-lg border border-input accent-primary'
      />
      {disabled && (controlled ? checked : defaultChecked) && (
        <input type='hidden' name={name} value='on' />
      )}
      <Label htmlFor={id}>{label}</Label>
    </div>
  )
}
