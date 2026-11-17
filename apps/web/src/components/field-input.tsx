import { useId } from 'react'
import { t } from '@/lib/i18n'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

export type FieldDefinition = {
  name: string
  label: string
  type?: 'text' | 'number' | 'checkbox' | 'textarea' | 'select'
  required?: boolean
  maxLength?: number
  pattern?: string
  min?: number
  max?: number
  defaultValue?: string | boolean
  options?: readonly { value: string; label: string }[]
  immutable?: boolean
}
export function FieldInput({
  field,
  value,
  disabled = false,
}: {
  field: FieldDefinition
  value?: string | boolean
  disabled?: boolean
}) {
  const id = useId()
  const initial = value ?? field.defaultValue ?? ''
  return (
    <div className='space-y-2'>
      <Label htmlFor={id}>{field.label}</Label>
      {field.type === 'checkbox' ? (
        <div>
          <Checkbox
            id={id}
            name={field.name}
            defaultChecked={initial === true || initial === 'true'}
            disabled={disabled}
          />
        </div>
      ) : field.type === 'select' ? (
        <>
          <Select
            name={field.name}
            defaultValue={String(initial) || undefined}
            required={field.required}
            disabled={disabled}
          >
            <SelectTrigger id={id}>
              <SelectValue
                placeholder={t('common:actions.selectPlaceholder')}
              />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {disabled && (
            <input type='hidden' name={field.name} value={String(initial)} />
          )}
        </>
      ) : field.type === 'textarea' ? (
        <Textarea
          id={id}
          name={field.name}
          defaultValue={String(initial)}
          required={field.required}
          maxLength={field.maxLength}
          readOnly={disabled}
          rows={5}
        />
      ) : (
        <Input
          id={id}
          name={field.name}
          type={field.type === 'number' ? 'number' : 'text'}
          defaultValue={String(initial)}
          required={field.required}
          maxLength={field.maxLength}
          pattern={field.pattern}
          min={field.min}
          max={field.max}
          step={field.type === 'number' ? 1 : undefined}
          readOnly={disabled}
        />
      )}
    </div>
  )
}
