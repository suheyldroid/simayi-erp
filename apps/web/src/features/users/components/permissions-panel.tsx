import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { actionFields, type EffectivePermissions } from '../access-model'

export function PermissionsPanel({
  effective,
}: {
  effective: EffectivePermissions
}) {
  return (
    <div className='space-y-4'>
      <h2 className='text-xl font-semibold'>Effective permissions</h2>
      <p className='text-sm text-muted-foreground'>
        {effective.isAdministrator
          ? 'Platform administrator: full access, including ownership-protected resources.'
          : 'Permissions are the union of your group RuleSets. A new account has no business permissions. Ownership alone never grants access.'}
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
          {effective.permissions.map((rule) => (
            <TableRow key={rule.name}>
              <TableCell>{rule.name}</TableCell>
              {Object.entries(actionFields).map(([action, field]) => (
                <TableCell key={action}>
                  {rule[field] ? 'Granted' : 'Denied'}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className='text-sm text-muted-foreground'>
        Server decisions use current memberships on every protected operation.
        Administrative delegation cannot change native Better Auth roles or
        credentials.
      </p>
    </div>
  )
}
