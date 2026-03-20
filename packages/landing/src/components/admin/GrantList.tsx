/**
 * Grant List component
 * Displays and manages grants for an organization
 */

import { LoaderIcon, Trash2Icon } from 'lucide-react';

interface Grant {
  id: string;
  type: string;
  startsAt?: string | number | Date;
  expiresAt?: string | number | Date;
  createdAt?: string | number | Date;
  revokedAt?: string | number | Date | null;
}

interface GrantListProps {
  grants: Grant[];
  loading: boolean;
  isLoading: boolean;
  onRevoke: (_grantId: string) => void;
}

const formatDate = (timestamp: string | number | Date | null | undefined): string => {
  if (!timestamp) return '-';
  const date =
    timestamp instanceof Date ? timestamp
    : typeof timestamp === 'string' ? new Date(timestamp)
    : new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export function GrantList({ grants: grantsProp, loading, isLoading, onRevoke }: GrantListProps) {
  const grants = grantsProp || [];

  return (
    <div className='border-border bg-card rounded-lg border'>
      <div className='border-border border-b px-6 py-4'>
        <h2 className='text-foreground text-lg font-semibold'>Grants</h2>
      </div>
      {isLoading ?
        <div className='flex items-center justify-center py-12'>
          <LoaderIcon className='size-8 animate-spin text-blue-600' />
        </div>
      : <div className='p-6'>
          {grants.length > 0 ?
            <div className='flex flex-col gap-4'>
              {grants.map(grant => (
                <div key={grant.id} className='border-border rounded-lg border p-4'>
                  <div className='flex items-start justify-between'>
                    <div className='flex-1'>
                      <div className='flex items-center gap-2'>
                        <p className='text-foreground font-medium capitalize'>{grant.type}</p>
                        {grant.revokedAt ?
                          <span className='inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive'>
                            Revoked
                          </span>
                        : <span className='inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800'>
                            Active
                          </span>
                        }
                      </div>
                      <div className='text-muted-foreground mt-2 grid grid-cols-2 gap-4 text-sm'>
                        <div>
                          <p>Starts: {formatDate(grant.startsAt)}</p>
                          <p>Expires: {formatDate(grant.expiresAt)}</p>
                        </div>
                        <div>
                          <p>Created: {formatDate(grant.createdAt)}</p>
                          {grant.revokedAt && <p>Revoked: {formatDate(grant.revokedAt)}</p>}
                        </div>
                      </div>
                    </div>
                    {!grant.revokedAt && (
                      <div className='ml-4'>
                        <button
                          onClick={() => onRevoke?.(grant.id)}
                          disabled={loading}
                          className='bg-card rounded-lg border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50'
                          aria-label='Revoke grant'
                        >
                          <Trash2Icon className='size-4' />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          : <p className='text-muted-foreground text-sm'>No grants</p>}
        </div>
      }
    </div>
  );
}
