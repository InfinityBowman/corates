import { createSignal, createEffect, onMount, Show, For, createMemo } from 'solid-js';
import { useNavigate } from '@solidjs/router';
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
import {
  Select,
  SelectControl,
  SelectTrigger,
  SelectValueText,
  SelectIndicator,
  SelectPositioner,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectItemIndicator,
  createListCollection,
} from '@/components/ui/select';
import { useBetterAuth } from '@api/better-auth-store.js';
import ErrorMessage from './ErrorMessage.jsx';
import { PrimaryButton } from './AuthButtons.jsx';
import RoleSelector, { TITLE_OPTIONS } from './RoleSelector.jsx';
import { FiCheck } from 'solid-icons/fi';
import { handleError } from '@/lib/error-utils.js';
import { apiFetch } from '@lib/apiFetch.js';
import { showToast } from '@corates/ui';

const STEPS = [
  { title: 'Your Name', description: 'Basic information' },
  { title: 'Institution', description: 'Academic details' },
  { title: 'Role', description: 'Your background' },
];

/**
 * Complete Profile page - shown after email verification or OAuth signup
 * Step 1: first name, last name, title (required: name)
 * Step 2: institution, department (optional, can skip)
 * Step 3: persona selection (optional, can skip)
 */
const titleCollection = createListCollection({
  items: TITLE_OPTIONS,
  itemToString: item => item.label,
  itemToValue: item => item.value,
});

export default function CompleteProfile() {
  const [currentStep, setCurrentStep] = createSignal(0);
  const [firstName, setFirstName] = createSignal('');
  const [lastName, setLastName] = createSignal('');
  const [titleSelection, setTitleSelection] = createSignal([]);
  const [customTitle, setCustomTitle] = createSignal('');
  const [institution, setInstitution] = createSignal('');
  const [department, setDepartment] = createSignal('');

  // Compute the actual title value (either selected or custom)
  const title = createMemo(() => {
    const selected = titleSelection()[0];
    if (selected === 'other') {
      return customTitle().trim();
    }
    return selected || '';
  });

  const isCustomTitle = createMemo(() => titleSelection()[0] === 'other');
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
  function validateStep1() {
    setError('');
    if (!firstName().trim() || !lastName().trim()) {
      setError('Please enter your first and last name');
      return false;
    }
    return true;
  }

  function handleStep1Next(e) {
    e.preventDefault();
    if (validateStep1()) {
      setCurrentStep(1);
    }
  }

  function handleStep2Next(e) {
    e.preventDefault();
    setError('');
    setCurrentStep(2);
  }

  function handleStepChange(details) {
    // When going forward from step 1, validate
    if (details.step > currentStep() && currentStep() === 0) {
      if (!validateStep1()) {
        return;
      }
    }
    setError('');
    setCurrentStep(details.step);
  }

  // Final submit - save profile (persona is optional)
  async function handleSubmit(selectedPersona = persona()) {
    setLoading(true);
    setError('');

    // Check for invitation token in URL params (from magic link callback) or localStorage (fallback)
    const urlParams = new URLSearchParams(window.location.search);

    try {
      const fullName = `${firstName().trim()} ${lastName().trim()}`;

      await updateProfile({
        name: fullName,
        persona: selectedPersona || 'other',
        profileCompletedAt: Math.floor(Date.now() / 1000),
        title: title() || null,
        institution: institution().trim() || null,
        department: department().trim() || null,
      });

      // Clear the signup flags
      localStorage.removeItem('oauthSignup');
      localStorage.removeItem('magicLinkSignup');
      localStorage.removeItem('pendingName');
      localStorage.removeItem('pendingPersona');

      const invitationToken =
        urlParams.get('invitation') || localStorage.getItem('pendingInvitationToken');

      if (invitationToken) {
        try {
          const result = await apiFetch.post(
            '/api/invitations/accept',
            { token: invitationToken },
            { toastMessage: false },
          );
          localStorage.removeItem('pendingInvitationToken');

          // Redirect to the project (use org-scoped path when available)
          if (result.projectId) {
            showToast.success(
              'Invitation Accepted',
              `You've been added to "${result.projectName}"`,
            );
            const projectPath =
              result.orgSlug ?
                `/orgs/${result.orgSlug}/projects/${result.projectId}`
              : `/projects/${result.projectId}`;
            navigate(projectPath, { replace: true });
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
        <div class='relative w-full max-w-md rounded-xl border border-gray-100 bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-10'>
          {/* Logo */}
          <a href='/' class='absolute top-4 left-4 sm:top-5 sm:left-5'>
            <img src='/logo.svg' alt='CoRATES' class='h-6 w-auto sm:h-7' />
          </a>

          <Steps
            count={STEPS.length}
            step={currentStep()}
            onStepChange={handleStepChange}
            linear
          >
            {/* Step Indicator */}
            <StepsList class='mb-6 flex items-center justify-center pt-4'>
              <For each={STEPS}>
                {(stepInfo, index) => (
                  <StepsItem index={index()} class='flex items-center'>
                    <StepsTrigger
                      class='group flex flex-col items-center focus:outline-none'
                      disabled={index() > currentStep() + 1}
                    >
                      <StepsIndicator
                        class='flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors
                          data-[current]:bg-blue-600 data-[current]:text-white
                          data-[complete]:bg-blue-600 data-[complete]:text-white
                          data-[incomplete]:bg-gray-200 data-[incomplete]:text-gray-500
                          group-hover:data-[incomplete]:bg-gray-300'
                      >
                        <Show when={index() < currentStep()} fallback={index() + 1}>
                          <FiCheck class='h-4 w-4' />
                        </Show>
                      </StepsIndicator>
                      <span class='mt-1 hidden text-xs text-gray-500 sm:block'>
                        {stepInfo.title}
                      </span>
                    </StepsTrigger>
                    <Show when={index() < STEPS.length - 1}>
                      <StepsSeparator
                        class='mx-2 h-0.5 w-8 transition-colors sm:w-12
                          data-[complete]:bg-blue-600
                          data-[current]:bg-gray-200
                          data-[incomplete]:bg-gray-200'
                      />
                    </Show>
                  </StepsItem>
                )}
              </For>
            </StepsList>

            {/* Step 1: Name and Title */}
            <StepsContent index={0}>
              <div class='mb-5 text-center'>
                <h2 class='mb-1 text-xl font-bold text-gray-900 sm:text-2xl'>
                  Complete Your Profile
                </h2>
                <p class='text-xs text-gray-500 sm:text-sm'>Just a few details to get you started</p>
              </div>

              <form onSubmit={handleStep1Next} class='space-y-4' autocomplete='off'>
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

                {/* Title dropdown */}
                <div class='space-y-2'>
                  <label class='mb-1 block text-xs font-semibold text-gray-700 sm:text-sm'>
                    Title
                  </label>
                  <Select
                    collection={titleCollection}
                    value={titleSelection()}
                    onValueChange={details => setTitleSelection(details.value)}
                  >
                    <SelectControl>
                      <SelectTrigger class='w-full'>
                        <SelectValueText placeholder='Select a title (optional)' />
                        <SelectIndicator />
                      </SelectTrigger>
                    </SelectControl>
                    <SelectPositioner>
                      <SelectContent>
                        <For each={TITLE_OPTIONS}>
                          {option => (
                            <SelectItem item={option}>
                              <SelectItemText>{option.label}</SelectItemText>
                              <SelectItemIndicator />
                            </SelectItem>
                          )}
                        </For>
                      </SelectContent>
                    </SelectPositioner>
                  </Select>
                  <Show when={isCustomTitle()}>
                    <input
                      type='text'
                      value={customTitle()}
                      onInput={e => setCustomTitle(e.target.value)}
                      class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
                      placeholder='Enter your title'
                      maxLength={50}
                    />
                  </Show>
                </div>

                <ErrorMessage displayError={displayError} />

                <PrimaryButton loading={false}>Next</PrimaryButton>
              </form>
            </StepsContent>

            {/* Step 2: Institution Details */}
            <StepsContent index={1}>
              <div class='mb-5 text-center'>
                <h2 class='mb-1 text-xl font-bold text-gray-900 sm:text-2xl'>
                  Institution Details
                </h2>
                <p class='text-xs text-gray-500 sm:text-sm'>
                  Optional - helps us understand your background
                </p>
              </div>

              <form onSubmit={handleStep2Next} class='space-y-4' autocomplete='off'>
                {/* Institution */}
                <div>
                  <label
                    class='mb-1 block text-xs font-semibold text-gray-700 sm:text-sm'
                    for='institution-input'
                  >
                    University / Institution
                  </label>
                  <input
                    type='text'
                    id='institution-input'
                    autoComplete='organization'
                    value={institution()}
                    onInput={e => setInstitution(e.target.value)}
                    class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
                    placeholder='e.g., University of Oxford'
                    maxLength={200}
                  />
                </div>

                {/* Department */}
                <div>
                  <label
                    class='mb-1 block text-xs font-semibold text-gray-700 sm:text-sm'
                    for='department-input'
                  >
                    Department / Faculty
                  </label>
                  <input
                    type='text'
                    id='department-input'
                    value={department()}
                    onInput={e => setDepartment(e.target.value)}
                    class='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none'
                    placeholder='e.g., Department of Medicine'
                    maxLength={200}
                  />
                </div>

                <ErrorMessage displayError={displayError} />

                <div class='flex gap-3'>
                  <StepsPrevTrigger
                    type='button'
                    class='flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                  >
                    Back
                  </StepsPrevTrigger>
                  <button
                    type='submit'
                    class='flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                  >
                    Next
                  </button>
                </div>

                <button
                  type='button'
                  onClick={() => setCurrentStep(2)}
                  class='w-full py-2 text-sm text-gray-500 transition hover:text-gray-700'
                >
                  Skip for now
                </button>
              </form>
            </StepsContent>

            {/* Step 3: Persona Selection */}
            <StepsContent index={2}>
              <div class='mb-5 text-center'>
                <h2 class='mb-1 text-xl font-bold text-gray-900 sm:text-2xl'>
                  What best describes you?
                </h2>
                <p class='text-xs text-gray-500 sm:text-sm'>This helps us tailor your experience</p>
              </div>

              <form onSubmit={handleFinish} class='space-y-4'>
                <RoleSelector selectedRole={persona()} onSelect={handleRoleSelect} />

                <ErrorMessage displayError={displayError} />

                <div class='flex gap-3'>
                  <StepsPrevTrigger
                    type='button'
                    class='flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                  >
                    Back
                  </StepsPrevTrigger>
                  <PrimaryButton loading={loading()} loadingText='Finishing...' disabled={!persona()}>
                    Finish Setup
                  </PrimaryButton>
                </div>

                <button
                  type='button'
                  onClick={handleSkip}
                  disabled={loading()}
                  class='w-full py-2 text-sm text-gray-500 transition hover:text-gray-700 disabled:opacity-50'
                >
                  Skip for now
                </button>
              </form>
            </StepsContent>

            {/* Completed Content (shows after all steps) */}
            <StepsCompletedContent>
              <div class='flex flex-col items-center justify-center py-8'>
                <div class='mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100'>
                  <FiCheck class='h-8 w-8 text-green-600' />
                </div>
                <h2 class='mb-2 text-xl font-bold text-gray-900'>All Done!</h2>
                <p class='text-sm text-gray-500'>Redirecting to your dashboard...</p>
              </div>
            </StepsCompletedContent>
          </Steps>
        </div>
      </Show>
    </div>
  );
}
