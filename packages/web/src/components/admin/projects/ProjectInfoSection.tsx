import { Link } from '@tanstack/react-router';
import { HardDriveIcon } from 'lucide-react';
import { AdminBox, CopyButton } from '@/components/admin/ui';
import { formatFileSize } from '@corates/shared';
import { formatDateTime } from '@/lib/formatDate';
import type { ProjectData } from './types';

interface ProjectInfoSectionProps {
  project: ProjectData['project'];
  stats: ProjectData['stats'];
}

export function ProjectInfoSection({ project, stats }: ProjectInfoSectionProps) {
  return (
    <AdminBox className='mb-6'>
      <h2 className='text-foreground mb-4 text-lg font-semibold'>Project Information</h2>
      <dl className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <div>
          <dt className='text-muted-foreground text-sm font-medium'>Project ID</dt>
          <dd className='text-foreground mt-1 flex items-center text-sm'>
            <span className='font-mono'>{project.id}</span>
            <CopyButton
              text={project.id}
              label='Project ID'
              className='text-muted-foreground/70 hover:text-muted-foreground ml-2'
              iconSize='size-4'
            />
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-sm font-medium'>Organization</dt>
          <dd className='mt-1 text-sm'>
            <Link
              to={'/admin/orgs/$orgId' as string}
              params={{ orgId: project.orgId } as Record<string, string>}
              className='text-primary hover:text-primary/80'
            >
              {project.orgName}
            </Link>
            <span className='text-muted-foreground ml-1'>@{project.orgSlug}</span>
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-sm font-medium'>Created By</dt>
          <dd className='mt-1 text-sm'>
            <Link
              to={'/admin/users/$userId' as string}
              params={{ userId: project.createdBy } as Record<string, string>}
              className='text-primary hover:text-primary/80'
            >
              {project.creatorDisplayName || project.creatorName || project.creatorEmail}
            </Link>
          </dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-sm font-medium'>Created</dt>
          <dd className='text-foreground mt-1 text-sm'>{formatDateTime(project.createdAt)}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-sm font-medium'>Updated</dt>
          <dd className='text-foreground mt-1 text-sm'>{formatDateTime(project.updatedAt)}</dd>
        </div>
        <div>
          <dt className='text-muted-foreground text-sm font-medium'>Storage Used</dt>
          <dd className='text-foreground mt-1 flex items-center text-sm'>
            <HardDriveIcon className='text-muted-foreground/70 mr-1 size-4' />
            {formatFileSize(stats.totalStorageBytes)}
          </dd>
        </div>
      </dl>
    </AdminBox>
  );
}
