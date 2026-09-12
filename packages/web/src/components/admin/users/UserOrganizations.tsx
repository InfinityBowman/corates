import { Link } from '@tanstack/react-router';
import { AdminEmpty, AdminPanel, ADMIN_TH, ADMIN_TD, ADMIN_TD_MUTED } from '@/components/admin/ui';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { formatDate } from '@/lib/formatDate';
import type { AdminUserOrg } from '@/server/functions/admin-users.server';

export function UserOrganizations({ orgs }: { orgs?: AdminUserOrg[] }) {
  const rows = orgs ?? [];

  return (
    <AdminPanel title={`Organizations (${rows.length})`}>
      {rows.length === 0 ?
        <AdminEmpty title='No organizations' description='This user is not a member of any org.' />
      : <Table>
          <TableHeader className='bg-muted/40'>
            <TableRow className='border-border hover:bg-transparent'>
              <TableHead className={ADMIN_TH}>Organization</TableHead>
              <TableHead className={ADMIN_TH}>Role</TableHead>
              <TableHead className={ADMIN_TH}>Plan</TableHead>
              <TableHead className={ADMIN_TH}>Access</TableHead>
              <TableHead className={ADMIN_TH}>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(org => (
              <TableRow key={org.orgId} className='border-border'>
                <TableCell className={ADMIN_TD}>
                  <Link
                    to={'/admin/orgs/$orgId' as string}
                    params={{ orgId: org.orgId } as Record<string, string>}
                    className='text-foreground hover:text-primary font-medium transition-colors'
                  >
                    {org.orgName}
                  </Link>
                  <p className='text-muted-foreground text-xs'>@{org.orgSlug}</p>
                </TableCell>
                <TableCell className={ADMIN_TD}>
                  <Badge variant={org.role === 'owner' ? 'default' : 'secondary'}>{org.role}</Badge>
                </TableCell>
                <TableCell className={ADMIN_TD_MUTED}>{org.billing.planName}</TableCell>
                <TableCell className={ADMIN_TD}>
                  <Badge
                    variant={
                      org.billing.accessMode === 'full' ? 'success'
                      : org.billing.accessMode === 'readOnly' ?
                        'warning'
                      : 'secondary'
                    }
                  >
                    {org.billing.accessMode}
                  </Badge>
                </TableCell>
                <TableCell className={`${ADMIN_TD_MUTED} tabular-nums`}>
                  {formatDate(org.membershipCreatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    </AdminPanel>
  );
}
