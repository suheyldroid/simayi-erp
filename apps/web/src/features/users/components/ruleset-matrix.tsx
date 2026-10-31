import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { accessApi, refreshAccess } from '../access-api'
import { actionFields, type Rule } from '../access-model'

function MatrixForm({
  groupId,
  initial,
  canEdit,
  administrator,
}: {
  groupId: number
  initial: Rule[]
  canEdit: boolean
  administrator: boolean
}) {
  const [rules, setRules] = useState(initial)
  const [saving, setSaving] = useState(false)
  const client = useQueryClient()
  function toggle(
    index: number,
    field: (typeof actionFields)[keyof typeof actionFields],
    checked: boolean
  ) {
    setRules((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row
        const next = { ...row, [field]: checked }
        next.canChange ||= next.canAdd || next.canDelete
        next.canView ||= next.canChange
        return next
      })
    )
  }
  async function save() {
    setSaving(true)
    try {
      const result = await accessApi.updateRules(groupId, rules)
      setRules(result.rules)
      await refreshAccess(client)
      toast.success('Permissions saved.')
    } catch {
      toast.error(
        'Could not save. Grants cannot exceed your own permissions; reload and retry.'
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className='space-y-3'>
      <p className='text-sm text-muted-foreground'>
        Add/delete imply change; change implies view. Administrative grants
        require a platform administrator.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Scope</TableHead>
            {Object.keys(actionFields).map((action) => (
              <TableHead key={action}>{action}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule, index) => (
            <TableRow key={rule.name}>
              <TableCell>{rule.name}</TableCell>
              {Object.entries(actionFields).map(([action, field]) => {
                const inherited =
                  (field === 'canView' &&
                    (rule.canChange || rule.canAdd || rule.canDelete)) ||
                  (field === 'canChange' && (rule.canAdd || rule.canDelete))
                return (
                  <TableCell key={action}>
                    <Checkbox
                      aria-label={`${rule.name} ${action}`}
                      checked={rule[field]}
                      disabled={
                        !canEdit ||
                        saving ||
                        (!administrator && rule.name === 'admin') ||
                        inherited
                      }
                      onCheckedChange={(value) =>
                        toggle(index, field, value === true)
                      }
                    />
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {canEdit && (
        <Button disabled={saving} onClick={() => void save()}>
          Save permissions
        </Button>
      )}
    </div>
  )
}
export function RuleSetMatrix({
  groupId,
  canEdit,
  administrator,
}: {
  groupId: number
  canEdit: boolean
  administrator: boolean
}) {
  const rules = useQuery({
    queryKey: ['group-rules', groupId],
    queryFn: () => accessApi.rules(groupId),
    refetchOnWindowFocus: false,
  })
  if (rules.isPending) return <p role='status'>Loading permissions…</p>
  if (rules.isError)
    return (
      <p role='alert'>
        Could not load permissions.{' '}
        <Button variant='outline' onClick={() => void rules.refetch()}>
          Retry
        </Button>
      </p>
    )
  return (
    <MatrixForm
      key={groupId}
      groupId={groupId}
      initial={rules.data.rules}
      canEdit={canEdit}
      administrator={administrator}
    />
  )
}
