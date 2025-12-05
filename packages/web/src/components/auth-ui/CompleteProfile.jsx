import { createSignal, createEffect, onMount, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { useBetterAuth } from '@api/better-auth-store.js';
import StrengthIndicator from './StrengthIndicator.jsx';
import PasswordInput from '../zag/PasswordInput.jsx';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton } from './AuthButtons.jsx';
import RoleSelector from './RoleSelector.jsx';
import StepIndicator from './StepIndicator.jsx';

/**
 * Complete Profile page - shown after email verification or OAuth signup
 * Step 1: first name, last name, password (email users)
 * Step 2: role selection (optional, can skip)
 */
export default function CompleteProfile() {
  const [step, setStep] = createSignal(1);
  const [firstName, setFirstName] = createSignal('');
  const [lastName, setLastName] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [confirmPassword, setConfirmPassword] = createSignal('');
  const [role, setRole] = createSignal('');
  const [error, setError] = createSignal('');
  const [unmetRequirements, setUnmetRequirements] = createSignal([]);
  const [loading, setLoading] = createSignal(false);

  const navigate = useNavigate();
  const { user, updateProfile, authLoading } = useBetterAuth();

  // Check if user needs to set password (email signup vs OAuth)
  // OAuth users (Google, ORCID) already have authentication - they don't need a password
  // We detect OAuth users by checking if they have emailVerified=true AND came from OAuth flow
  // The 'oauthSignup' flag is set in localStorage during OAuth signup flow
  const needsPassword = () => {
    const isOAuthUser = localStorage.getItem('oauthSignup') === 'true';
    return !isOAuthUser;
  };

  // Pre-fill name if available from OAuth
  onMount(() => {
    const currentUser = user();
    if (currentUser?.name) {
      const nameParts = currentUser.name.split(' ');
      if (nameParts.length >= 2) {
        setFirstName(nameParts[0]);
        setLastName(nameParts.slice(1).join(' '));
      } else {
        setFirstName(currentUser.name);
      }
    }

    // Check for pending role from OAuth flow
    const pendingRole = localStorage.getItem('pendingRole');
    if (pendingRole) {
      setRole(pendingRole);
      localStorage.removeItem('pendingRole');
    }

    // If user already has a role set, redirect to dashboard
    if (currentUser?.role) {
      navigate('/dashboard', { replace: true });
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

    if (needsPassword()) {
      if (!password() || !confirmPassword()) {
        setError('Please set a password');
        return;
      }

      if (password() !== confirmPassword()) {
        setError('Passwords do not match');
        return;
      }

      if (unmetRequirements().length > 0) {
        setError(`Password must include ${unmetRequirements()[0]}`);
        return;
      }
    }

    setStep(2);
  }

  function handleBack() {
    setStep(1);
    setError('');
  }

  // Final submit - save profile (role is optional)
  async function handleSubmit(selectedRole = role()) {
    setLoading(true);
    setError('');

    try {
      const fullName = `${firstName().trim()} ${lastName().trim()}`;

      await updateProfile({
        name: fullName,
        displayName: fullName,
        role: selectedRole || 'other', // Default to 'other' if skipped
      });

      // Clear the OAuth signup flag
      localStorage.removeItem('oauthSignup');

      await new Promise(resolve => setTimeout(resolve, 200));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Profile update error:', err);
      const msg = err.message?.toLowerCase() || '';

      if (msg.includes('failed to fetch') || msg.includes('network')) {
        setError('Unable to connect to the server. Please check your connection.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleRoleSelect(selectedRole) {
    setRole(selectedRole);
  }

  function handleSkip() {
    handleSubmit('other');
  }

  function handleFinish(e) {
    e.preventDefault();
    handleSubmit(role());
  }

  createEffect(() => {
    if (needsPassword() && password() === confirmPassword() && error().includes('match')) {
      setError('');
    }
  });

  const displayError = () => error();

  return (
    <div class='h-full bg-blue-50 flex items-center justify-center px-4 py-6 sm:py-12'>
      <Show
        when={!authLoading()}
        fallback={
          <div class='w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin' />
        }
      >
        <div class='w-full max-w-md sm:max-w-xl bg-white rounded-xl sm:rounded-3xl shadow-2xl p-5 sm:p-10 border border-gray-100'>
          <StepIndicator currentStep={step()} totalSteps={2} />

          {/* Step 1: Name and Password */}
          <Show when={step() === 1}>
            <div class='text-center mb-5'>
              <h2 class='text-xl sm:text-2xl font-bold text-gray-900 mb-1'>
                Complete Your Profile
              </h2>
              <p class='text-gray-500 text-xs sm:text-sm'>Just a few details to get you started</p>
            </div>

            <form onSubmit={handleNextStep} class='space-y-4' autocomplete='off'>
              {/* Name fields - side by side */}
              <div class='grid grid-cols-2 gap-3'>
                <div>
                  <label
                    class='block text-xs sm:text-sm font-semibold text-gray-700 mb-1'
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
                    onInput={e => setFirstName(e.target.value)}
                    class='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition'
                    required
                    id='first-name-input'
                    placeholder='First'
                  />
                </div>
                <div>
                  <label
                    class='block text-xs sm:text-sm font-semibold text-gray-700 mb-1'
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
                    onInput={e => setLastName(e.target.value)}
                    class='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition'
                    required
                    id='last-name-input'
                    placeholder='Last'
                  />
                </div>
              </div>

              {/* Password fields - only for email signups */}
              <Show when={needsPassword()}>
                <div>
                  <PasswordInput
                    password={password()}
                    onPasswordChange={setPassword}
                    autoComplete='new-password'
                    required
                  />
                  <StrengthIndicator password={password()} onUnmet={setUnmetRequirements} />
                </div>

                <div>
                  <label
                    class='block text-xs sm:text-sm font-semibold text-gray-700 mb-1'
                    for='confirm-password-input'
                  >
                    Confirm Password
                  </label>
                  <input
                    type='password'
                    autoComplete='new-password'
                    autocapitalize='off'
                    spellCheck='false'
                    value={confirmPassword()}
                    onInput={e => setConfirmPassword(e.target.value)}
                    class='w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition big-placeholder'
                    required
                    id='confirm-password-input'
                    placeholder='••••••••'
                  />
                </div>
              </Show>

              <ErrorMessage displayError={displayError} />

              <PrimaryButton loading={false}>Next</PrimaryButton>
            </form>
          </Show>

          {/* Step 2: Role Selection */}
          <Show when={step() === 2}>
            <div class='mb-3'>
              <button
                type='button'
                onClick={handleBack}
                class='text-sm text-gray-500 hover:text-gray-700 flex items-center'
              >
                <svg class='w-4 h-4 mr-1' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path
                    stroke-linecap='round'
                    stroke-linejoin='round'
                    stroke-width='2'
                    d='M15 19l-7-7 7-7'
                  />
                </svg>
                Back
              </button>
            </div>

            <div class='text-center mb-5'>
              <h2 class='text-xl sm:text-2xl font-bold text-gray-900 mb-1'>
                What best describes you?
              </h2>
              <p class='text-gray-500 text-xs sm:text-sm'>This helps us tailor your experience</p>
            </div>

            <form onSubmit={handleFinish} class='space-y-4'>
              <RoleSelector selectedRole={role()} onSelect={handleRoleSelect} />

              <ErrorMessage displayError={displayError} />

              <PrimaryButton loading={loading()} loadingText='Finishing...' disabled={!role()}>
                Finish Setup
              </PrimaryButton>

              <button
                type='button'
                onClick={handleSkip}
                disabled={loading()}
                class='w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition disabled:opacity-50'
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
