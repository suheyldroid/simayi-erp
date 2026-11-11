import { useId } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
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
  const labelId = `${id}-label`
  const controlled = checked !== undefined
  return (
    <div className='flex items-center gap-2'>
      <Checkbox
        id={id}
        name={name}
        aria-labelledby={labelId}
        defaultChecked={controlled ? undefined : defaultChecked}
        checked={controlled ? checked : undefined}
        disabled={disabled}
        onCheckedChange={
          onChange ? (value) => onChange(value === true) : undefined
        }
      />
      {disabled && (controlled ? checked : defaultChecked) && (
        <input type='hidden' name={name} value='on' />
      )}
      <Label id={labelId} htmlFor={id}>
        {label}
      </Label>
    </div>
  )
}
