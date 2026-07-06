/**
 * Invitation landing page - the stable link sent in invitation emails.
 *
 * Handles every auth state:
 * - Signed out: shows the invitation and offers sign up / sign in. The token
 *   is stashed in localStorage so signup -> complete-profile can auto-accept,
 *   and sign-in flows can return here.
 * - Signed in: shows the invitation with an Accept button.
 * - Invalid / expired / already-accepted tokens get clear explanations.
 */

import { useState, useEffect } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { MailIcon, CheckIcon, AlertTriangleIcon, ClockIcon } from 'lucide-react';
import { useAuthStore, selectUser, selectIsAuthLoading } from '@/stores/authStore';
import { getInvitation, acceptInvitation } from '@/server/functions/invitations.functions';
import { getDomainError, getUserFriendlyMessage, parseError } from '@/lib/error-utils';
import { showToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { PrimaryButton } from '@/components/auth/AuthButtons';
import { RouteError } from '@/components/RouteError';

export const Route = createFileRoute('/invite/$token')({
  ssr: false,
  component: InvitePage,
  errorComponent: RouteError,
});

interface InvitationSummary {
  status: 'pending' | 'expired' | 'accepted';
  projectName: string;
  inviterName: string;
  email: string;
  role: string | null;
}

type LoadState =
  { kind: 'loading' } | { kind: 'invalid' } | { kind: 'loaded'; invitation: InvitationSummary };

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const user = useAuthStore(selectUser);
  const isAuthLoading = useAuthStore(selectIsAuthLoading);
  const signout = useAuthStore(s => s.signout);

  const [loadState, setLoadState] = useState<LoadState>({ kind: 'loading' });
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const invitation = (await getInvitation({ data: { token } })) as InvitationSummary;
        if (cancelled) return;

        if (invitation.status === 'pending') {
          // Stash the token so signup -> complete-profile and sign-in flows
          // can resume acceptance after authentication.
          localStorage.setItem('pendingInvitationToken', token);
        }
        setLoadState({ kind: 'loaded', invitation });
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load invitation:', err);
        setLoadState({ kind: 'invalid' });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setAcceptError('');
    try {
      const result = await acceptInvitation({ data: { token } });
      localStorage.removeItem('pendingInvitationToken');
      showToast.success('Invitation Accepted', `You've been added to "${result.projectName}"`);
      navigate({ to: '/dashboard', replace: true });
    } catch (err) {
      const domainError = getDomainError(err);
      const details = domainError?.details as Record<string, unknown> | undefined;
      if (details?.reason === 'email_mismatch') {
        setAcceptError(
          'This invitation was sent to a different email address. Sign in with the invited email to accept it.',
        );
      } else if (domainError?.code === 'PROJECT_MEMBER_ALREADY_EXISTS') {
        localStorage.removeItem('pendingInvitationToken');
        showToast.success('Already a Member', 'You already have access to this project.');
        navigate({ to: '/dashboard', replace: true });
        return;
      } else {
        setAcceptError(getUserFriendlyMessage(parseError(err)));
      }
      setAccepting(false);
    }
  }

  async function handleSwitchAccount() {
    await signout();
    navigate({ to: '/signin' });
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-50 px-4'>
      <div className='border-border bg-card relative w-full max-w-md rounded-xl border p-6 text-center shadow-2xl sm:rounded-3xl sm:p-10'>
        <a href='/' className='absolute top-4 left-4 sm:top-5 sm:left-5'>
          <img src='/logo.svg' alt='CoRATES' className='h-6 w-auto sm:h-7' />
        </a>

        <div className='pt-6'>{renderContent()}</div>
      </div>
    </div>
  );

  function renderContent() {
    if (loadState.kind === 'loading' || (loadState.kind === 'loaded' && isAuthLoading)) {
      return (
        <p className='text-muted-foreground py-8 text-sm' role='status'>
          Loading invitation...
        </p>
      );
    }

    if (loadState.kind === 'invalid') {
      return (
        <StatusMessage
          icon={<AlertTriangleIcon className='text-destructive size-8' />}
          title='Invalid Invitation'
          body='This invitation link is not valid. It may have been cancelled, or the link may be incomplete.'
        />
      );
    }

    const { invitation } = loadState;

    if (invitation.status === 'expired') {
      return (
        <StatusMessage
          icon={<ClockIcon className='text-muted-foreground size-8' />}
          title='Invitation Expired'
          body={`This invitation to "${invitation.projectName}" has expired. Ask ${invitation.inviterName} to send a new one.`}
        />
      );
    }

    if (invitation.status === 'accepted') {
      return (
        <StatusMessage
          icon={<CheckIcon className='text-success size-8' />}
          title='Invitation Already Used'
          body={`This invitation to "${invitation.projectName}" has already been accepted.`}
          footer={
            <Link
              to='/dashboard'
              className='text-primary text-sm underline-offset-4 hover:underline'
            >
              Go to dashboard
            </Link>
          }
        />
      );
    }

    const roleText = invitation.role === 'owner' ? 'an Owner' : 'a Member';

    return (
      <div className='flex flex-col gap-5'>
        <div className='bg-primary/10 mx-auto flex size-14 items-center justify-center rounded-full'>
          <MailIcon className='text-primary size-7' />
        </div>
        <div>
          <h1 className='text-foreground mb-2 text-xl font-bold sm:text-2xl'>
            You&apos;re Invited
          </h1>
          <p className='text-muted-foreground text-sm'>
            <strong className='text-foreground'>{invitation.inviterName}</strong> invited you to
            join <strong className='text-foreground'>&quot;{invitation.projectName}&quot;</strong>{' '}
            as {roleText}.
          </p>
        </div>

        {user ?
          <div className='flex flex-col gap-3'>
            <p className='text-muted-foreground text-xs'>
              Signed in as <strong className='text-foreground'>{user.email}</strong>
            </p>
            {acceptError && (
              <p className='text-destructive text-sm' role='alert'>
                {acceptError}
              </p>
            )}
            <PrimaryButton
              type='button'
              onClick={handleAccept}
              loading={accepting}
              loadingText='Accepting...'
            >
              Accept Invitation
            </PrimaryButton>
            <Button
              type='button'
              variant='link'
              onClick={handleSwitchAccount}
              className='text-muted-foreground hover:text-secondary-foreground mx-auto'
            >
              Sign in with a different account
            </Button>
          </div>
        : <div className='flex flex-col gap-3'>
            <p className='text-muted-foreground text-xs'>
              This invitation was sent to{' '}
              <strong className='text-foreground'>{invitation.email}</strong>
            </p>
            <PrimaryButton type='button' onClick={() => navigate({ to: '/signup' })}>
              Create Account & Accept
            </PrimaryButton>
            <p className='text-muted-foreground text-sm'>
              Already have an account?{' '}
              <Link
                to='/signin'
                className='text-primary font-medium underline-offset-4 hover:underline'
              >
                Sign in
              </Link>
            </p>
          </div>
        }
      </div>
    );
  }
}

function StatusMessage({
  icon,
  title,
  body,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className='flex flex-col items-center gap-4 py-4'>
      <div className='bg-secondary flex size-14 items-center justify-center rounded-full'>
        {icon}
      </div>
      <h1 className='text-foreground text-xl font-bold sm:text-2xl'>{title}</h1>
      <p className='text-muted-foreground text-sm'>{body}</p>
      {footer}
    </div>
  );
}
