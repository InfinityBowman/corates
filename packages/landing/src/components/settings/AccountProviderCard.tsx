/**
 * AccountProviderCard - Displays a single linked authentication provider
 */

import { useMemo } from 'react';
import { MailIcon, Trash2Icon, CheckIcon, ExternalLinkIcon } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

function formatOrcidId(id: string) {
  if (!id) return '';
  if (id.includes('-')) return id;
  return id.replace(/(\d{4})(\d{4})(\d{4})(\d{3}[\dXx])/, '$1-$2-$3-$4');
}

interface Provider {
  id: string;
  name: string;
  icon: string | null;
}

interface Account {
  id: string;
  providerId: string;
  email?: string;
  accountId?: string;
  createdAt?: string | number;
}

interface AccountProviderCardProps {
  account: Account;
  provider?: Provider;
  canUnlink: boolean;
  unlinking: boolean;
  onUnlink: () => void;
}

export function AccountProviderCard({
  account,
  provider,
  canUnlink,
  unlinking,
  onUnlink,
}: AccountProviderCardProps) {
  const displayId = useMemo(() => {
    if (account.providerId === 'credential') return account.email || 'Email/Password';
    if (account.providerId === 'orcid') return formatOrcidId(account.accountId || '');
    return account.email || account.accountId;
  }, [account]);

  const linkedDate = useMemo(() => {
    if (!account.createdAt) return null;
    const date = new Date(
      typeof account.createdAt === 'number' ? account.createdAt * 1000 : account.createdAt,
    );
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [account.createdAt]);

  const isCredential = account.providerId === 'credential';
  const isOrcid = account.providerId === 'orcid';
  const orcidProfileUrl =
    isOrcid && account.accountId
      ? `https://orcid.org/${formatOrcidId(account.accountId)}`
      : null;

  return (
    <div className="border-border bg-muted flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <div className="border-border bg-card rounded-lg border p-2">
          {provider?.icon ? (
            <img src={provider.icon} alt={provider?.name} className="h-5 w-5" />
          ) : (
            <MailIcon className="text-secondary-foreground h-5 w-5" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-foreground font-medium">
              {provider?.name || account.providerId}
            </p>
            {isCredential && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                <CheckIcon className="h-3 w-3" />
                Primary
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <p className="text-muted-foreground text-sm">{displayId}</p>
            {isOrcid && orcidProfileUrl && (
              <a
                href={orcidProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/70 hover:text-secondary-foreground transition-colors"
                aria-label="View ORCID profile"
              >
                <ExternalLinkIcon className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          {linkedDate && (
            <p className="text-muted-foreground/70 mt-0.5 text-xs">Linked on {linkedDate}</p>
          )}
        </div>
      </div>

      {!isCredential &&
        (canUnlink ? (
          <button
            onClick={onUnlink}
            disabled={unlinking}
            className="text-destructive hover:bg-destructive/10 inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Unlink ${provider?.name} account`}
          >
            <Trash2Icon className="h-4 w-4" />
            {unlinking ? 'Unlinking...' : 'Unlink'}
          </button>
        ) : (
          <Tooltip>
            <TooltipTrigger>
              <span className="text-muted-foreground/70 cursor-help text-xs">
                Only sign-in method
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Can&apos;t unlink your only sign-in method. Link another account first.
            </TooltipContent>
          </Tooltip>
        ))}
    </div>
  );
}
