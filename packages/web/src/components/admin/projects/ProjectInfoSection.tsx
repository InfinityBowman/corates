import { Link } from '@tanstack/react-router';
import { AdminPanel, AdminField, AdminFieldGrid, CopyButton } from '@/components/admin/ui';
import { formatFileSize } from '@corates/shared';
import { formatDateTime } from '@/lib/formatDate';
import type { AdminProjectDetails } from '@/server/functions/admin-projects.server';

interface ProjectInfoSectionProps {
  project: AdminProjectDetails['project'];
  stats: AdminProjectDetails['stats'];
}

export function ProjectInfoSection({ project, stats }: ProjectInfoSectionProps) {
  return (
    <AdminPanel title='Project Information' padded>
      <AdminFieldGrid>
        <AdminField label='Project ID' mono>
          <span className='truncate'>{project.id}</span>
          <CopyButton text={project.id} label='Project ID' />
        </AdminField>
        <AdminField label='Organization'>
          <Link
            to={'/admin/orgs/$orgId' as string}
            params={{ orgId: project.orgId } as Record<string, string>}
            className='text-primary hover:text-primary/80'
          >
            {project.orgName}
          </Link>
          <span className='text-muted-foreground'>@{project.orgSlug}</span>
        </AdminField>
        <AdminField label='Created by'>
          <Link
            to={'/admin/users/$userId' as string}
            params={{ userId: project.createdBy } as Record<string, string>}
            className='text-primary hover:text-primary/80'
          >
            {project.creatorName || project.creatorEmail}
          </Link>
        </AdminField>
        <AdminField label='Created'>{formatDateTime(project.createdAt)}</AdminField>
        <AdminField label='Updated'>{formatDateTime(project.updatedAt)}</AdminField>
        <AdminField label='Storage used'>{formatFileSize(stats.totalStorageBytes)}</AdminField>
      </AdminFieldGrid>
    </AdminPanel>
  );
}
