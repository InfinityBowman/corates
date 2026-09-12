/**
 * Invitation landing page - the stable link sent in invitation emails.
 *
 * The loader resolves the invitation and the viewer together, so the page is
 * server-rendered with the right call to action already painted. Signed-out
 * visitors sign up here rather than at /signup, since the invited address is
 * already known.
 */

import { useState, useEffect } from 'react';
import { createFileRoute, useNavigate, useHydrated, Link } from '@tanstack/react-router';
import { CheckIcon, AlertTriangleIcon, ClockIcon } from 'lucide-react';
import { useAuthStore, selectUser, selectIsAuthLoading } from '@/stores/authStore';
import { getInvitation, acceptInvitation } from '@/server/functions/invitations.functions';
import { normalizeError, VALIDATION_ERRORS } from '@corates/shared';
import { getDomainError, getUserFriendlyMessage, handleError } from '@/lib/error-utils';
import { showToast } from '@/lib/toast';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from '@/lib/queryKeys';
import { Avatar, AvatarFallback, getInitials } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PrimaryButton } from '@/components/auth/AuthButtons';
import { ErrorMessage } from '@/components/auth/ErrorMessage';
import {
  GoogleButton,
  OrcidButton,
  SocialAuthContainer,
  AuthDivider,
} from '@/components/auth/SocialAuthButtons';
import { EmailCodeForm } from '@/components/auth/EmailCodeForm';
import { useBfcacheReset } from '@/hooks/useBfcacheReset';
import { RouteError } from '@/components/RouteError';
import { NOINDEX_META } from '@/config/app';
import { setPendingInvitationToken, clearPendingInvitationToken } from '@/lib/pendingInvitation';

export const Route = createFileRoute('/invite/$token')({
  head: () => ({ meta: [NOINDEX_META] }),
  loader: async ({ params: { token } }) => {
    try {
      return await getInvitation({ data: { token } });
    } catch (err) {
      // An unknown token is a page state; anything else is a real failure.
      if (getDomainError(err)?.code === VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code) {
        return { invitation: null, viewer: null };
      }
      throw err;
    }
  },
  component: InvitePage,
  errorComponent: RouteError,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { invitation, viewer } = Route.useLoaderData();
  const navigate = useNavigate();
  const isHydrated = useHydrated();
  const storeUser = useAuthStore(selectUser);
  const isAuthLoading = useAuthStore(selectIsAuthLoading);
  const signout = useAuthStore(s => s.signout);
  const signinWithGoogle = useAuthStore(s => s.signinWithGoogle);
  const signinWithOrcid = useAuthStore(s => s.signinWithOrcid);

  const [accepting, setAccepting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [orcidLoading, setOrcidLoading] = useState(false);
  const [error, setError] = useState('');

  // The store reads cachedUser synchronously, so it would disagree with the
  // server on the first render. The loader's answer holds until it settles.
  const viewerEmail =
    isHydrated && !isAuthLoading ? (storeUser?.email ?? null) : (viewer?.email ?? null);

  useEffect(() => {
    // Arriving here ends any auth round-trip that was carrying a token
    clearPendingInvitationToken();
  }, [token]);

  useBfcacheReset(() => {
    setGoogleLoading(false);
    setOrcidLoading(false);
  });

  async function handleAccept() {
    setAccepting(true);
    setError('');
    try {
      const result = await acceptInvitation({ data: { token } });
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations.pendingForMe });
      showToast.success('Invitation accepted', `You now have access to "${result.projectName}"`);
      navigate({ to: '/dashboard', replace: true });
    } catch (err) {
      if (getDomainError(err)?.code === 'PROJECT_MEMBER_ALREADY_EXISTS') {
        showToast.success('Already a member', 'You already have access to this project.');
        navigate({ to: '/dashboard', replace: true });
        return;
      }
      setError(getUserFriendlyMessage(normalizeError(err)));
      setAccepting(false);
    }
  }

  async function handleSocial(provider: 'google' | 'orcid') {
    const setLoading = provider === 'google' ? setGoogleLoading : setOrcidLoading;
    setLoading(true);
    setError('');
    setPendingInvitationToken(token);
    try {
      localStorage.setItem('oauthSignup', 'true');
      const signin = provider === 'google' ? signinWithGoogle : signinWithOrcid;
      await signin('/complete-profile', { requestSignUp: true });
    } catch (err) {
      await handleError(err, { setError, showToast: false });
      localStorage.removeItem('oauthSignup');
      setLoading(false);
    }
  }

  async function handleSwitchAccount() {
    await signout();
    setPendingInvitationToken(token);
    navigate({ to: '/signin' });
  }

  if (!invitation) {
    return (
      <InviteShell>
        <StatusMessage
          icon={<AlertTriangleIcon className='text-destructive size-8' />}
          title='This link is not valid'
          body='It may have been cancelled, or the link may be incomplete. Ask the person who invited you to send a new one.'
        />
      </InviteShell>
    );
  }

  if (invitation.status === 'expired') {
    return (
      <InviteShell>
        <StatusMessage
          icon={<ClockIcon className='text-muted-foreground size-8' />}
          title='This invitation expired'
          body={`Ask ${invitation.inviterName} for a new link to "${invitation.projectName}".`}
        />
      </InviteShell>
    );
  }

  if (invitation.status === 'accepted') {
    return (
      <InviteShell>
        <StatusMessage
          icon={<CheckIcon className='text-success size-8' />}
          title='You already joined'
          body={`This link has been used. "${invitation.projectName}" is on your dashboard.`}
          footer={
            <Link
              to='/dashboard'
              className='text-primary text-sm underline-offset-4 hover:underline'
            >
              Go to dashboard
            </Link>
          }
        />
      </InviteShell>
    );
  }

  return (
    <InviteShell
      band={
        <div className='bg-primary/5 border-border flex items-center gap-3 border-b px-5 py-4'>
          <Avatar className='size-10 shrink-0'>
            <AvatarFallback className='bg-primary/10 text-primary text-xs font-semibold'>
              {getInitials(invitation.inviterName)}
            </AvatarFallback>
          </Avatar>
          <div className='min-w-0'>
            <p className='text-muted-foreground text-xs'>{invitation.inviterName} invited you to</p>
            <h1 className='text-foreground text-sm leading-snug font-semibold'>
              {invitation.projectName}
            </h1>
          </div>
        </div>
      }
    >
      <div className='flex flex-col gap-4 p-6 sm:p-8'>
        {viewerEmail ?
          <>
            <h2 className='text-foreground text-lg font-bold'>Accept this invitation</h2>
            <ErrorMessage error={error} id='invite-error' />
            <PrimaryButton
              type='button'
              onClick={handleAccept}
              loading={accepting}
              loadingText='Accepting...'
            >
              Accept invitation
            </PrimaryButton>
            <p className='text-muted-foreground text-center text-xs'>
              Signed in as <strong className='text-foreground'>{viewerEmail}</strong>
            </p>
            {viewerEmail.toLowerCase() !== invitation.email.toLowerCase() && (
              <p className='text-muted-foreground text-center text-xs'>
                This invitation was sent to{' '}
                <strong className='text-foreground'>{invitation.email}</strong>
              </p>
            )}
            <Button
              type='button'
              variant='link'
              onClick={handleSwitchAccount}
              className='text-muted-foreground hover:text-secondary-foreground mx-auto'
            >
              Sign in with a different account
            </Button>
          </>
        : <>
            <h2 className='text-foreground text-lg font-bold'>Create your account to accept</h2>
            <SocialAuthContainer>
              <GoogleButton loading={googleLoading} onClick={() => handleSocial('google')} />
              <OrcidButton loading={orcidLoading} onClick={() => handleSocial('orcid')} />
            </SocialAuthContainer>

            <AuthDivider className='my-0 sm:my-0' />

            <ErrorMessage error={error} id='invite-error' />

            <EmailCodeForm
              callbackPath='/complete-profile'
              buttonText='Continue with Email'
              initialEmail={invitation.email}
              onBeforeSend={() => setPendingInvitationToken(token)}
            />

            <p className='text-muted-foreground text-center text-sm'>
              Already have an account?{' '}
              <Link
                to='/signin'
                onClick={() => setPendingInvitationToken(token)}
                className='text-primary font-medium underline-offset-4 hover:underline'
              >
                Sign in
              </Link>
            </p>
          </>
        }

        <p className='text-muted-foreground border-border border-t pt-4 text-center text-xs'>
          {invitation.daysUntilExpiry > 0 ?
            `This invitation expires in ${invitation.daysUntilExpiry} ${invitation.daysUntilExpiry === 1 ? 'day' : 'days'}.`
          : 'This invitation expires today.'}
        </p>
      </div>
    </InviteShell>
  );
}

function InviteShell({ band, children }: { band?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10'>
      <div className='border-border bg-card w-full max-w-md overflow-hidden rounded-xl border shadow-2xl sm:rounded-3xl'>
        <a href='/' className='flex items-center gap-2 px-5 py-3'>
          <img src='/logo.svg' alt='' className='h-5 w-auto' aria-hidden='true' />
          <span className='text-foreground text-sm font-bold tracking-tight'>CoRATES</span>
        </a>
        {band}
        {children}
      </div>
    </div>
  );
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
    <div className='flex flex-col items-center gap-4 p-6 text-center sm:p-10'>
      <div className='bg-secondary flex size-14 items-center justify-center rounded-full'>
        {icon}
      </div>
      <h1 className='text-foreground text-xl font-bold sm:text-2xl'>{title}</h1>
      <p className='text-muted-foreground text-sm'>{body}</p>
      {footer}
    </div>
  );
}
