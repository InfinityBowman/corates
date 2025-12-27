import { createSignal, createEffect, onMount, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton } from './AuthButtons.jsx';
import RoleSelector from './RoleSelector.jsx';
import StepIndicator from './StepIndicator.jsx';
import { FiChevronLeft } from 'solid-icons/fi';
import { handleError, handleFetchError } from '@/lib/error-utils.js';
import { API_BASE } from '@config/api.js';
import { showToast } from '@corates/ui';

/**
 * Complete Profile page - shown after email verification or OAuth signup
 * Step 1: first name, last name (required)
 * Step 2: persona selection (optional, can skip)
 */
export default function CompleteProfile() {
  const [step, setStep] = createSignal(1);
  const [firstName, setFirstName] = createSignal('');
  const [lastName, setLastName] = createSignal('');
  const [hasEditedName, setHasEditedName] = createSignal(false);
  const [hasAutofilledName, setHasAutofilledName] = createSignal(false);
  const [persona, setPersona] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const navigate = useNavigate();
  const { user, updateProfile, authLoading } = useBetterAuth();

  // Pre-fill from session user (OAuth can provide name). Only fill when fields are empty.
  createEffect(() => {
    const currentUser = user();

    // If already completed onboarding, go to dashboard.
    if (currentUser?.profileCompletedAt) {
      navigate('/dashboard', { replace: true });
      return;
    }

    // Once the user has edited either name field, never re-autofill.
    if (hasEditedName() || hasAutofilledName()) return;

    if (!currentUser) {
      // Magic link users may not have a meaningful name yet; use the pending email as a placeholder.
      const pendingName = localStorage.getItem('pendingName');
      if (!firstName().trim() && !lastName().trim() && pendingName) {
        setFirstName(pendingName);
        setHasAutofilledName(true);
      }
      return;
    }

    // If the backend created a placeholder name (e.g. 'user'), prefer the submitted email as the initial value.
    const pendingName = localStorage.getItem('pendingName');
    if (
      pendingName &&
      !firstName().trim() &&
      !lastName().trim() &&
      (!currentUser?.name || String(currentUser.name).trim().toLowerCase() === 'user')
    ) {
      setFirstName(pendingName);
      setHasAutofilledName(true);
      return;
    }

    if (!firstName().trim() && !lastName().trim() && currentUser?.name) {
      const nameParts = String(currentUser.name).trim().split(/\s+/).filter(Boolean);
      if (nameParts.length >= 2) {
        setFirstName(nameParts[0]);
        setLastName(nameParts.slice(1).join(' '));
      } else if (nameParts.length === 1) {
        // If magic link created a placeholder name (e.g. the email), keep last name empty so user must provide it.
        setFirstName(nameParts[0]);
      }

      setHasAutofilledName(true);
    }
  });

  onMount(() => {
    // Preserve any pre-selected persona from earlier steps if present.
    const pendingPersona = localStorage.getItem('pendingPersona');
    if (pendingPersona) {
      setPersona(pendingPersona);
      localStorage.removeItem('pendingPersona');
    }
  });

  // Redirect if not authenticated
  createEffect(() => {
    if (!authLoading() && !user()) {
      navigate('/signup', { replace: true });
    }
  });

  // Validate step 1 and proceed to step 2
  function handleNextStep(e) {
    e.preventDefault();
    setError('');

    if (!firstName().trim() || !lastName().trim()) {
      setError('Please enter your first and last name');
      return;
    }

    setStep(2);
  }

  function handleBack() {
    setStep(1);
    setError('');
  }

  // Final submit - save profile (role is optional)
  async function handleSubmit(selectedPersona = persona()) {
    setLoading(true);
    setError('');

    // Check for invitation token in URL params (from magic link callback) or localStorage (fallback)
    const urlParams = new URLSearchParams(window.location.search);

    try {
      const fullName = `${firstName().trim()} ${lastName().trim()}`;

      await updateProfile({
        name: fullName,
        // persona is optional, but we store a default when skipped
        persona: selectedPersona || 'other',
        profileCompletedAt: Math.floor(Date.now() / 1000),
      });

      // Clear the signup flags
      localStorage.removeItem('oauthSignup');
      localStorage.removeItem('magicLinkSignup');
      localStorage.removeItem('pendingName');
      localStorage.removeItem('pendingPersona');

      const invitationToken =
        urlParams.get('invitation') || localStorage.getItem('pendingInvitationToken');
      console.log('invitationToken', invitationToken);
      if (invitationToken) {
        try {
          const response = await handleFetchError(
            fetch(`${API_BASE}/api/invitations/accept`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ token: invitationToken }),
            }),
            {
              showToast: false,
            },
          );

          const result = await response.json();
          localStorage.removeItem('pendingInvitationToken');

          // Redirect to the project
          if (result.projectId) {
            showToast.success(
              'Invitation Accepted',
              `You've been added to "${result.projectName}"`,
            );
            navigate(`/projects/${result.projectId}`, { replace: true });
            return;
          }
        } catch (inviteErr) {
          // Log error but don't block profile completion
          console.error('Failed to accept invitation:', inviteErr);
          localStorage.removeItem('pendingInvitationToken');
          // Continue to dashboard
        }
      }

      await new Promise(resolve => setTimeout(resolve, 200));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      await handleError(err, {
        setError,
        showToast: false,
      });
    } finally {
      setLoading(false);
    }
  }

  function handleRoleSelect(selectedRole) {
    setPersona(selectedRole);
  }

  function handleSkip() {
    handleSubmit('other');
  }

  function handleFinish(e) {
    e.preventDefault();
    handleSubmit(persona());
  }

  const displayError = () => error();

  return (
    <div class='flex h-full items-center justify-center bg-blue-50 px-4 py-6 sm:py-12'>
      <Show
        when={!authLoading()}
        fallback={
          <div class='h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent' />
        }
      >
        <div class='w-full max-w-md rounded-xl border border-gray-100 bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-10'>
          <StepIndicator currentStep={step()} totalSteps={2} />

          {/* Step 1: Name */}
          <Show when={step() === 1}>
            <div class='mb-5 text-center'>
              <h2 class='mb-1 text-xl font-bold text-gray-900 sm:text-2xl'>
                Complete Your Profile
              </h2>
              <p class='text-xs text-gray-500 sm:text-sm'>Just a few details to get you started</p>
            </div>

            <form onSubmit={handleNextStep} class='space-y-4' autocomplete='off'>
              {/* Name fields - side by side */}
              <div class='grid grid-cols-2 gap-3'>
                <div>
                  <label
                    class='mb-1 block text-xs font-semibold text-gray-700 sm:text-sm'
                    for='first-name-input'
                  >
                    First Name
                  </label>
                  <input
                    type='text'
                    autoComplete='given-name'
                    autocapitalize='words'
                    spellcheck='false'
                    value={firstName()}
                    onInput={e => {
                      setHasEditedName(true);
                      setFirstName(e.target.value);
                    }}
                    class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
                    required
                    id='first-name-input'
                    placeholder='First'
                  />
                </div>
                <div>
                  <label
                    class='mb-1 block text-xs font-semibold text-gray-700 sm:text-sm'
                    for='last-name-input'
                  >
                    Last Name
                  </label>
                  <input
                    type='text'
                    autoComplete='family-name'
                    autocapitalize='words'
                    spellcheck='false'
                    value={lastName()}
                    onInput={e => {
                      setHasEditedName(true);
                      setLastName(e.target.value);
                    }}
                    class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
                    required
                    id='last-name-input'
                    placeholder='Last'
                  />
                </div>
              </div>

              <ErrorMessage displayError={displayError} />

              <PrimaryButton loading={false}>Next</PrimaryButton>
            </form>
          </Show>

          {/* Step 2: Persona Selection */}
          <Show when={step() === 2}>
            <div class='mb-3'>
              <button
                type='button'
                onClick={handleBack}
                class='flex items-center text-sm text-gray-500 hover:text-gray-700'
              >
                <FiChevronLeft class='mr-1 h-4 w-4' />
                Back
              </button>
            </div>

            <div class='mb-5 text-center'>
              <h2 class='mb-1 text-xl font-bold text-gray-900 sm:text-2xl'>
                What best describes you?
              </h2>
              <p class='text-xs text-gray-500 sm:text-sm'>This helps us tailor your experience</p>
            </div>

            <form onSubmit={handleFinish} class='space-y-4'>
              <RoleSelector selectedRole={persona()} onSelect={handleRoleSelect} />

              <ErrorMessage displayError={displayError} />

              <PrimaryButton loading={loading()} loadingText='Finishing...' disabled={!persona()}>
                Finish Setup
              </PrimaryButton>

              <button
                type='button'
                onClick={handleSkip}
                disabled={loading()}
                class='w-full py-2 text-sm text-gray-500 transition hover:text-gray-700 disabled:opacity-50'
              >
                Skip for now
              </button>
            </form>
          </Show>
        </div>
      </Show>
    </div>
  );
}
