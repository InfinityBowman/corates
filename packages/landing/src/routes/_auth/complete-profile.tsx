import { useState, useEffect, useMemo, useCallback } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { CheckIcon } from 'lucide-react';
import { useAuthStore, selectUser, selectIsAuthLoading } from '@/stores/authStore';
import { handleError } from '@/lib/error-utils';
import { apiFetch } from '@/lib/apiFetch';
import { showToast } from '@/components/ui/toast';
import {
  hasPendingPlan,
  clearPendingPlan,
  handlePendingPlanRedirect,
  BILLING_MESSAGES,
} from '@/lib/plan-redirect-utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Steps,
  StepsList,
  StepsItem,
  StepsTrigger,
  StepsIndicator,
  StepsSeparator,
  StepsContent,
  StepsPrevTrigger,
  StepsCompletedContent,
} from '@/components/ui/steps';
import { ErrorMessage } from '@/components/auth/ErrorMessage';
import { PrimaryButton } from '@/components/auth/AuthButtons';
import { RoleSelector, TITLE_OPTIONS } from '@/components/auth/RoleSelector';
import { Spinner } from '@/components/ui/spinner';

const STEPS_CONFIG = [
  { title: 'Your Name', description: 'Basic information' },
  { title: 'Institution', description: 'Academic details' },
  { title: 'Role', description: 'Your background' },
];

export const Route = createFileRoute('/_auth/complete-profile')({
  component: CompleteProfilePage,
});

function CompleteProfilePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [titleSelection, setTitleSelection] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [institution, setInstitution] = useState('');
  const [department, setDepartment] = useState('');
  const [persona, setPersona] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasEditedName, setHasEditedName] = useState(false);
  const [hasAutofilledName, setHasAutofilledName] = useState(false);

  const navigate = useNavigate();
  const user = useAuthStore(selectUser);
  const isAuthLoading = useAuthStore(selectIsAuthLoading);
  const updateProfile = useAuthStore(s => s.updateProfile);

  const title = useMemo(() => {
    if (titleSelection === 'other') return customTitle.trim();
    return titleSelection || '';
  }, [titleSelection, customTitle]);

  const isCustomTitle = titleSelection === 'other';

  // Redirect if already completed onboarding
  useEffect(() => {
    if (isAuthLoading) return;

    if (user?.profileCompletedAt) {
      if (hasPendingPlan()) {
        navigate({ to: '/settings/plans', replace: true });
      } else {
        navigate({ to: '/dashboard', replace: true });
      }
      return;
    }

    // Redirect if not authenticated
    if (!user) {
      navigate({ to: '/signup', replace: true });
    }
  }, [user, isAuthLoading, navigate]);

  // Pre-fill name from OAuth session or magic link pending data
  useEffect(() => {
    if (hasEditedName || hasAutofilledName || !user) {
      // For non-authenticated users, try pendingName from magic link
      if (!user && !hasEditedName && !hasAutofilledName) {
        const pendingName = localStorage.getItem('pendingName');
        if (!firstName.trim() && !lastName.trim() && pendingName) {
          setFirstName(pendingName);
          setHasAutofilledName(true);
        }
      }
      return;
    }

    // If backend created a placeholder name, prefer the submitted email
    const pendingName = localStorage.getItem('pendingName');
    if (
      pendingName &&
      !firstName.trim() &&
      !lastName.trim() &&
      (!user.name || String(user.name).trim().toLowerCase() === 'user')
    ) {
      setFirstName(pendingName);
      setHasAutofilledName(true);
      return;
    }

    // Use structured givenName/familyName from OAuth if available
    if (!firstName.trim() && !lastName.trim()) {
      const u = user as Record<string, unknown>;
      if (u.givenName || u.familyName) {
        setFirstName(String(u.givenName || ''));
        setLastName(String(u.familyName || ''));
        setHasAutofilledName(true);
      } else if (user.name) {
        const nameParts = String(user.name).trim().split(/\s+/).filter(Boolean);
        if (nameParts.length >= 2) {
          setFirstName(nameParts[0]);
          setLastName(nameParts.slice(1).join(' '));
        } else if (nameParts.length === 1) {
          setFirstName(nameParts[0]);
        }
        setHasAutofilledName(true);
      }
    }
  }, [user, hasEditedName, hasAutofilledName, firstName, lastName]);

  // Load pending persona from localStorage
  useEffect(() => {
    const pendingPersona = localStorage.getItem('pendingPersona');
    if (pendingPersona) {
      setPersona(pendingPersona);
      localStorage.removeItem('pendingPersona');
    }
  }, []);

  function validateStep1(): boolean {
    setError('');
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return false;
    }
    return true;
  }

  function handleStep1Next(e: React.FormEvent) {
    e.preventDefault();
    if (validateStep1()) setCurrentStep(1);
  }

  function handleStep2Next(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCurrentStep(2);
  }

  const handleStepChange = useCallback(
    (details: { step: number }) => {
      if (details.step > currentStep && currentStep === 0) {
        if (!validateStep1()) return;
      }
      setError('');
      setCurrentStep(details.step);
    },
    // validateStep1 reads firstName from closure -- stable enough for this use case
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentStep],
  );

  async function handleSubmit(selectedPersona = persona) {
    setLoading(true);
    setError('');

    const urlParams = new URLSearchParams(window.location.search);

    try {
      const givenName = firstName.trim();
      const familyName = lastName.trim();
      const fullName = [givenName, familyName].filter(Boolean).join(' ');

      await updateProfile({
        name: fullName,
        givenName: givenName || null,
        familyName: familyName || null,
        persona: selectedPersona || 'other',
        profileCompletedAt: Math.floor(Date.now() / 1000),
        title: title || null,
        institution: institution.trim() || null,
        department: department.trim() || null,
      });

      // Clear signup flags
      localStorage.removeItem('oauthSignup');
      localStorage.removeItem('pendingName');
      localStorage.removeItem('pendingPersona');

      // Handle invitation acceptance
      const invitationToken =
        urlParams.get('invitation') || localStorage.getItem('pendingInvitationToken');

      if (invitationToken) {
        try {
          const result = await apiFetch.post<{ projectId?: string; projectName?: string }>(
            '/api/invitations/accept',
            { token: invitationToken },
            { toastMessage: false },
          );
          localStorage.removeItem('pendingInvitationToken');

          if (result.projectId) {
            showToast.success(
              'Invitation Accepted',
              `You've been added to "${result.projectName}"`,
            );
            navigate({ to: '/dashboard', replace: true });
            return;
          }
        } catch (inviteErr) {
          console.error('Failed to accept invitation:', inviteErr);
          localStorage.removeItem('pendingInvitationToken');
        }
      }

      // Handle plan redirect from landing pricing page
      const { handled, error: planError } = await handlePendingPlanRedirect({ navigate });

      if (handled) {
        if (planError) {
          showToast.error(
            BILLING_MESSAGES.CHECKOUT_ERROR.title,
            BILLING_MESSAGES.CHECKOUT_ERROR.message,
          );
          navigate({ to: '/settings/plans', replace: true });
        }
        return;
      }

      // Default: go to dashboard
      clearPendingPlan();
      await new Promise(resolve => setTimeout(resolve, 200));
      navigate({ to: '/dashboard', replace: true });
    } catch (err) {
      await handleError(err, { setError, showToast: false });
    } finally {
      setLoading(false);
    }
  }

  if (isAuthLoading) {
    return <Spinner size='lg' label='Loading profile' />;
  }

  return (
    <div className='border-border bg-card relative w-full max-w-md rounded-xl border p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-10'>
      <a href='/' className='absolute top-4 left-4 sm:top-5 sm:left-5'>
        <img src='/logo.svg' alt='CoRATES' className='h-6 w-auto sm:h-7' />
      </a>

      <Steps count={STEPS_CONFIG.length} step={currentStep} onStepChange={handleStepChange} linear>
        {/* Step Indicator */}
        <StepsList className='mb-6 flex items-center justify-center pt-4'>
          {STEPS_CONFIG.map((stepInfo, index) => (
            <StepsItem key={stepInfo.title} index={index} className='flex items-center'>
              <StepsTrigger
                className='group flex flex-col items-center focus:outline-none'
                disabled={index > currentStep + 1}
              >
                <StepsIndicator className='data-complete:bg-primary data-complete:text-primary-foreground data-current:bg-primary data-current:text-primary-foreground data-incomplete:bg-secondary data-incomplete:text-muted-foreground group-hover:data-incomplete:bg-border flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-colors'>
                  {index < currentStep ?
                    <CheckIcon className='size-4' />
                  : index + 1}
                </StepsIndicator>
                <span className='text-muted-foreground mt-1 hidden text-xs sm:block'>
                  {stepInfo.title}
                </span>
              </StepsTrigger>
              {index < STEPS_CONFIG.length - 1 && (
                <StepsSeparator className='data-complete:bg-primary data-current:bg-secondary data-incomplete:bg-secondary mx-2 h-0.5 w-8 transition-colors sm:w-12' />
              )}
            </StepsItem>
          ))}
        </StepsList>

        {/* Step 1: Name and Title */}
        <StepsContent index={0}>
          <div className='mb-5 text-center'>
            <h2 className='text-foreground mb-1 text-xl font-bold sm:text-2xl'>
              Complete Your Profile
            </h2>
            <p className='text-muted-foreground text-xs sm:text-sm'>
              Just a few details to get you started
            </p>
          </div>

          <form onSubmit={handleStep1Next} className='flex flex-col gap-4' autoComplete='off'>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label
                  className='text-secondary-foreground mb-1 block text-xs font-semibold sm:text-sm'
                  htmlFor='first-name-input'
                >
                  First Name
                </label>
                <input
                  type='text'
                  autoComplete='given-name'
                  autoCapitalize='words'
                  spellCheck='false'
                  value={firstName}
                  onChange={e => {
                    setHasEditedName(true);
                    setFirstName(e.target.value);
                  }}
                  className='border-border focus:ring-primary w-full rounded-lg border px-3 py-2 text-sm transition focus:border-transparent focus:ring-2 focus:outline-none'
                  required
                  id='first-name-input'
                  placeholder='First'
                  aria-describedby={error ? 'profile-step1-error' : undefined}
                />
              </div>
              <div>
                <label
                  className='text-secondary-foreground mb-1 block text-xs font-semibold sm:text-sm'
                  htmlFor='last-name-input'
                >
                  Last Name <span className='text-muted-foreground/70 font-normal'>(optional)</span>
                </label>
                <input
                  type='text'
                  autoComplete='family-name'
                  autoCapitalize='words'
                  spellCheck='false'
                  value={lastName}
                  onChange={e => {
                    setHasEditedName(true);
                    setLastName(e.target.value);
                  }}
                  className='border-border focus:ring-primary w-full rounded-lg border px-3 py-2 text-sm transition focus:border-transparent focus:ring-2 focus:outline-none'
                  id='last-name-input'
                  placeholder='Last'
                  aria-describedby={error ? 'profile-step1-error' : undefined}
                />
              </div>
            </div>

            <div className='flex flex-col gap-2'>
              <label className='text-secondary-foreground mb-1 block text-xs font-semibold sm:text-sm'>
                Title
              </label>
              <Select value={titleSelection} onValueChange={v => setTitleSelection(v)}>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Select a title (optional)' />
                </SelectTrigger>
                <SelectContent>
                  {TITLE_OPTIONS.map(option => (
                    <SelectItem key={option.value || '__none'} value={option.value || '__none'}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCustomTitle && (
                <input
                  type='text'
                  value={customTitle}
                  onChange={e => setCustomTitle(e.target.value)}
                  className='border-border focus:ring-primary w-full rounded-lg border px-3 py-2 text-sm transition focus:border-transparent focus:ring-2 focus:outline-none'
                  placeholder='Enter your title'
                  maxLength={50}
                />
              )}
            </div>

            <ErrorMessage error={error} id='profile-step1-error' />

            <PrimaryButton loading={false}>Next</PrimaryButton>
          </form>
        </StepsContent>

        {/* Step 2: Institution Details */}
        <StepsContent index={1}>
          <div className='mb-5 text-center'>
            <h2 className='text-foreground mb-1 text-xl font-bold sm:text-2xl'>
              Institution Details
            </h2>
            <p className='text-muted-foreground text-xs sm:text-sm'>
              Optional - helps us understand your background
            </p>
          </div>

          <form onSubmit={handleStep2Next} className='flex flex-col gap-4' autoComplete='off'>
            <div>
              <label
                className='text-secondary-foreground mb-1 block text-xs font-semibold sm:text-sm'
                htmlFor='institution-input'
              >
                University / Institution
              </label>
              <input
                type='text'
                id='institution-input'
                autoComplete='organization'
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                className='border-border focus:ring-primary w-full rounded-lg border px-3 py-2 text-sm transition focus:border-transparent focus:ring-2 focus:outline-none'
                placeholder='e.g., University of Oxford'
                maxLength={200}
              />
            </div>

            <div>
              <label
                className='text-secondary-foreground mb-1 block text-xs font-semibold sm:text-sm'
                htmlFor='department-input'
              >
                Department / Faculty
              </label>
              <input
                type='text'
                id='department-input'
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className='border-border focus:ring-primary w-full rounded-lg border px-3 py-2 text-sm transition focus:border-transparent focus:ring-2 focus:outline-none'
                placeholder='e.g., Department of Medicine'
                maxLength={200}
              />
            </div>

            <ErrorMessage error={error} id='profile-step2-error' />

            <div className='flex gap-3'>
              <StepsPrevTrigger
                type='button'
                className='border-border bg-card text-secondary-foreground hover:bg-muted focus:ring-primary flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition focus:ring-2 focus:outline-none'
              >
                Back
              </StepsPrevTrigger>
              <button
                type='submit'
                className='bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus:ring-2 focus:outline-none'
              >
                Next
              </button>
            </div>

            <button
              type='button'
              onClick={() => setCurrentStep(2)}
              className='text-muted-foreground hover:text-secondary-foreground mx-auto block py-2 text-sm underline-offset-4 transition hover:underline'
            >
              Skip for now
            </button>
          </form>
        </StepsContent>

        {/* Step 3: Persona Selection */}
        <StepsContent index={2}>
          <div className='mb-5 text-center'>
            <h2 className='text-foreground mb-1 text-xl font-bold sm:text-2xl'>
              What best describes you?
            </h2>
            <p className='text-muted-foreground text-xs sm:text-sm'>
              This helps us tailor your experience
            </p>
          </div>

          <form
            onSubmit={e => {
              e.preventDefault();
              handleSubmit(persona);
            }}
            className='flex flex-col gap-4'
          >
            <RoleSelector selectedRole={persona} onSelect={setPersona} />

            <ErrorMessage error={error} id='profile-step3-error' />

            <div className='flex gap-3'>
              <StepsPrevTrigger
                type='button'
                className='border-border bg-card text-secondary-foreground hover:bg-muted focus:ring-primary flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition focus:ring-2 focus:outline-none'
              >
                Back
              </StepsPrevTrigger>
              <PrimaryButton loading={loading} loadingText='Finishing...' disabled={!persona}>
                Finish Setup
              </PrimaryButton>
            </div>

            <button
              type='button'
              onClick={() => handleSubmit('other')}
              disabled={loading}
              className='text-muted-foreground hover:text-secondary-foreground mx-auto block py-2 text-sm underline-offset-4 transition hover:underline disabled:opacity-50'
            >
              Skip for now
            </button>
          </form>
        </StepsContent>

        <StepsCompletedContent>
          <div className='flex flex-col items-center justify-center py-8'>
            <div className='bg-success-bg mb-4 flex size-16 items-center justify-center rounded-full'>
              <CheckIcon className='text-success size-8' />
            </div>
            <h2 className='text-foreground mb-2 text-xl font-bold'>All Done!</h2>
            <p className='text-muted-foreground text-sm'>Redirecting to your dashboard...</p>
          </div>
        </StepsCompletedContent>
      </Steps>
    </div>
  );
}
