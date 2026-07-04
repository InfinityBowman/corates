import { Link } from '@tanstack/react-router';
import { HomeIcon } from 'lucide-react';
import { AdminBox } from '@/components/admin/ui';
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
import type { UserOrg } from './types';

export function UserOrganizations({ orgs }: { orgs?: UserOrg[] }) {
  return (
    <AdminBox className='mb-6'>
      <h2 className='text-foreground mb-4 flex items-center text-lg font-semibold'>
        <HomeIcon className='mr-2 size-5' />
        Organizations ({orgs?.length ?? 0})
      </h2>
      {(orgs?.length ?? 0) > 0 ?
        <Table>
          <TableHeader>
            <TableRow className='border-border bg-muted border-b'>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Organization
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Role
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Plan
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Access
              </TableHead>
              <TableHead className='text-muted-foreground px-6 py-3 text-xs font-medium tracking-wider uppercase'>
                Joined
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orgs!.map(org => (
              <TableRow key={org.orgId}>
                <TableCell className='text-foreground px-4 py-3 text-sm'>
                  <Link
                    to={'/admin/orgs/$orgId' as string}
                    params={{ orgId: org.orgId } as Record<string, string>}
                    className='text-primary hover:text-primary/80 font-medium'
                  >
                    {org.orgName}
                  </Link>
                  <p className='text-muted-foreground text-xs'>@{org.orgSlug}</p>
                </TableCell>
                <TableCell className='text-foreground px-4 py-3 text-sm'>
                  <Badge
                    variant={
                      org.role === 'owner' ? 'default'
                      : org.role === 'admin' ?
                        'info'
                      : 'secondary'
                    }
                  >
                    {org.role}
                  </Badge>
                </TableCell>
                <TableCell className='text-foreground px-4 py-3 text-sm'>
                  {org.billing.planName}
                </TableCell>
                <TableCell className='text-foreground px-4 py-3 text-sm'>
                  <Badge
                    variant={
                      org.billing.accessMode === 'full' ? 'success'
                      : org.billing.accessMode === 'limited' ?
                        'warning'
                      : 'destructive'
                    }
                  >
                    {org.billing.accessMode}
                  </Badge>
                </TableCell>
                <TableCell className='text-muted-foreground px-4 py-3 text-sm'>
                  {formatDate(org.membershipCreatedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      : <p className='text-muted-foreground text-sm'>Not a member of any organizations</p>}
    </AdminBox>
  );
}
