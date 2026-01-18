/**
 * Project Creation Wizard Mock
 *
 * Design Direction: Material + Apple HIG blend for researchers
 * - Blue-oriented palette (trustworthy, calm, professional)
 * - Inter typography with clear hierarchy
 * - Generous whitespace, refined surfaces
 * - Subtle depth through shadows and layering
 * - Academic sensibility without being stuffy
 */

import { For, Show, createSignal, createMemo } from 'solid-js';
import { useSearchParams } from '@solidjs/router';
import {
  FiCheck,
  FiChevronRight,
  FiChevronLeft,
  FiInfo,
  FiX,
  FiExternalLink,
  FiUserPlus,
  FiMail,
  FiMoreHorizontal,
  FiTrash2,
  FiAlertCircle,
  FiUpload,
  FiSearch,
  FiFile,
  FiFileText,
  FiLink,
  FiFolder,
  FiCheckCircle,
  FiCopy,
  FiSliders,
} from 'solid-icons/fi';

// ============================================================================
// DESIGN TOKENS
// ============================================================================

// These would normally be CSS variables, inline here for mock isolation
const tokens = {
  // Primary blue palette - trustworthy, professional
  blue50: '#eff6ff',
  blue100: '#dbeafe',
  blue200: '#bfdbfe',
  blue300: '#93c5fd',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  blue900: '#1e3a8a',

  // Neutral slate - warm enough to not feel clinical
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',

  // Semantic colors
  success: '#059669',
  successLight: '#d1fae5',
};

// ============================================================================
// STEP CONFIGURATION
// ============================================================================

const steps = [
  { id: 1, label: 'Project Details', description: 'Name and configuration' },
  { id: 2, label: 'Team', description: 'Invite collaborators' },
  { id: 3, label: 'Studies', description: 'Import your corpus' },
  { id: 4, label: 'Assignment', description: 'Distribute reviews' },
];

const checklistOptions = [
  {
    id: 'amstar2',
    name: 'AMSTAR 2',
    description: 'Assessment of systematic reviews of interventions',
    domains: 16,
  },
  {
    id: 'robins-i',
    name: 'ROBINS-I',
    description: 'Risk of bias in non-randomized studies of interventions',
    domains: 7,
  },
  {
    id: 'rob2',
    name: 'RoB 2',
    description: 'Risk of bias in randomized trials',
    domains: 5,
  },
  {
    id: 'robis',
    name: 'ROBIS',
    description: 'Risk of bias in systematic reviews',
    domains: 4,
  },
];

// Mock organization members for autocomplete
const orgMembers = [
  { id: '1', name: 'Dr. Sarah Chen', email: 'sarah.chen@university.edu' },
  { id: '2', name: 'Dr. Michael Torres', email: 'm.torres@research.org' },
  { id: '3', name: 'Dr. Emily Watson', email: 'e.watson@institute.edu' },
  { id: '4', name: 'Dr. James Liu', email: 'j.liu@university.edu' },
  { id: '5', name: 'Dr. Anna Kowalski', email: 'a.kowalski@medical.edu' },
];

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Horizontal stepper with connected line
 * Apple-inspired minimal design with Material's clear affordances
 */
function Stepper(props) {
  return (
    <nav class='relative'>
      {/* Connection line */}
      <div
        class='absolute top-5 left-0 right-0 h-px'
        style={{ background: tokens.slate200, 'margin-left': '40px', 'margin-right': '40px' }}
      />

      <ol class='relative flex justify-between'>
        <For each={steps}>
          {(step, index) => {
            const isComplete = () => step.id < props.currentStep;
            const isCurrent = () => step.id === props.currentStep;
            const isFuture = () => step.id > props.currentStep;

            return (
              <li class='flex flex-col items-center' style={{ 'min-width': '120px' }}>
                {/* Step indicator */}
                <div
                  class='relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all duration-300'
                  style={{
                    background: isComplete() ? tokens.blue600
                      : isCurrent() ? tokens.blue600
                      : tokens.slate100,
                    color: isComplete() || isCurrent() ? 'white' : tokens.slate400,
                    'box-shadow': isCurrent() ? `0 0 0 4px ${tokens.blue100}` : 'none',
                  }}
                >
                  <Show when={isComplete()} fallback={step.id}>
                    <FiCheck class='h-5 w-5' />
                  </Show>
                </div>

                {/* Label */}
                <div class='mt-3 text-center'>
                  <p
                    class='text-sm font-medium transition-colors duration-200'
                    style={{
                      color: isCurrent() ? tokens.slate900
                        : isComplete() ? tokens.slate700
                        : tokens.slate400,
                    }}
                  >
                    {step.label}
                  </p>
                  <p
                    class='mt-0.5 text-xs transition-colors duration-200'
                    style={{ color: isCurrent() ? tokens.slate500 : tokens.slate400 }}
                  >
                    {step.description}
                  </p>
                </div>
              </li>
            );
          }}
        </For>
      </ol>
    </nav>
  );
}

/**
 * Checklist type selection card
 * Material-inspired card with Apple's attention to touch targets
 */
function ChecklistCard(props) {
  const isSelected = () => props.selected?.includes(props.checklist.id);

  return (
    <button
      type='button'
      onClick={() => props.onToggle(props.checklist.id)}
      class='group relative w-full rounded-xl border-2 p-4 text-left transition-all duration-200'
      style={{
        background: isSelected() ? tokens.blue50 : 'white',
        'border-color': isSelected() ? tokens.blue500 : tokens.slate200,
        'box-shadow': isSelected()
          ? `0 0 0 1px ${tokens.blue500}`
          : '0 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      {/* Selection indicator */}
      <div
        class='absolute top-4 right-4 flex h-5 w-5 items-center justify-center rounded-full transition-all duration-200'
        style={{
          background: isSelected() ? tokens.blue600 : tokens.slate100,
          color: isSelected() ? 'white' : 'transparent',
        }}
      >
        <FiCheck class='h-3 w-3' />
      </div>

      <h4
        class='text-base font-semibold'
        style={{ color: tokens.slate900 }}
      >
        {props.checklist.name}
      </h4>

      <p
        class='mt-1 text-sm leading-relaxed'
        style={{ color: tokens.slate600 }}
      >
        {props.checklist.description}
      </p>

      <p
        class='mt-2 text-xs'
        style={{ color: tokens.slate400 }}
      >
        {props.checklist.domains} domains
      </p>
    </button>
  );
}

/**
 * Form field wrapper with label
 * Clean, accessible form pattern
 */
function FormField(props) {
  return (
    <div class={props.class}>
      <label
        class='mb-1.5 block text-sm font-medium'
        style={{ color: tokens.slate700 }}
      >
        {props.label}
        <Show when={props.required}>
          <span style={{ color: tokens.blue600 }}> *</span>
        </Show>
      </label>
      {props.children}
      <Show when={props.hint}>
        <p class='mt-1.5 text-xs' style={{ color: tokens.slate500 }}>
          {props.hint}
        </p>
      </Show>
    </div>
  );
}

/**
 * Text input with consistent styling
 */
function TextInput(props) {
  return (
    <input
      type={props.type || 'text'}
      value={props.value}
      onInput={e => props.onInput?.(e.target.value)}
      placeholder={props.placeholder}
      class='w-full rounded-lg border px-3 py-2.5 text-sm transition-all duration-200 outline-none'
      style={{
        'border-color': tokens.slate200,
        background: 'white',
        color: tokens.slate900,
      }}
      onFocus={e => {
        e.target.style.borderColor = tokens.blue500;
        e.target.style.boxShadow = `0 0 0 3px ${tokens.blue100}`;
      }}
      onBlur={e => {
        e.target.style.borderColor = tokens.slate200;
        e.target.style.boxShadow = 'none';
      }}
    />
  );
}

/**
 * Textarea with consistent styling
 */
function TextArea(props) {
  return (
    <textarea
      value={props.value}
      onInput={e => props.onInput?.(e.target.value)}
      placeholder={props.placeholder}
      rows={props.rows || 3}
      class='w-full resize-none rounded-lg border px-3 py-2.5 text-sm transition-all duration-200 outline-none'
      style={{
        'border-color': tokens.slate200,
        background: 'white',
        color: tokens.slate900,
      }}
      onFocus={e => {
        e.target.style.borderColor = tokens.blue500;
        e.target.style.boxShadow = `0 0 0 3px ${tokens.blue100}`;
      }}
      onBlur={e => {
        e.target.style.borderColor = tokens.slate200;
        e.target.style.boxShadow = 'none';
      }}
    />
  );
}

/**
 * Primary action button
 */
function PrimaryButton(props) {
  return (
    <button
      type={props.type || 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      class='inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-200'
      style={{
        background: props.disabled ? tokens.slate200 : tokens.blue600,
        color: props.disabled ? tokens.slate400 : 'white',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={e => {
        if (!props.disabled) e.target.style.background = tokens.blue700;
      }}
      onMouseLeave={e => {
        if (!props.disabled) e.target.style.background = tokens.blue600;
      }}
    >
      {props.children}
    </button>
  );
}

/**
 * Secondary/ghost button
 */
function SecondaryButton(props) {
  return (
    <button
      type='button'
      onClick={props.onClick}
      class='inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200'
      style={{
        background: 'transparent',
        color: tokens.slate600,
      }}
      onMouseEnter={e => {
        e.target.style.background = tokens.slate100;
      }}
      onMouseLeave={e => {
        e.target.style.background = 'transparent';
      }}
    >
      {props.children}
    </button>
  );
}

// ============================================================================
// STEP 1: PROJECT DETAILS FORM
// ============================================================================

function ProjectDetailsStep(props) {
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [selectedChecklists, setSelectedChecklists] = createSignal(['amstar2']);

  const toggleChecklist = id => {
    const current = selectedChecklists();
    if (current.includes(id)) {
      // Don't allow deselecting last one
      if (current.length > 1) {
        setSelectedChecklists(current.filter(c => c !== id));
      }
    } else {
      setSelectedChecklists([...current, id]);
    }
  };

  const isValid = () => name().trim().length >= 3 && selectedChecklists().length > 0;

  return (
    <div class='mx-auto max-w-3xl'>
      {/* Section: Basic Info */}
      <section>
        <h2
          class='text-lg font-semibold'
          style={{ color: tokens.slate900 }}
        >
          Basic Information
        </h2>
        <p
          class='mt-1 text-sm'
          style={{ color: tokens.slate500 }}
        >
          Give your project a name and optional description.
        </p>

        <div class='mt-6 space-y-5'>
          <FormField label='Project Name' required>
            <TextInput
              value={name()}
              onInput={setName}
              placeholder='e.g., Mindfulness Interventions for Chronic Pain'
            />
          </FormField>

          <FormField
            label='Description'
            hint='Optional. Briefly describe the scope or research question.'
          >
            <TextArea
              value={description()}
              onInput={setDescription}
              placeholder='Examining randomized controlled trials of mindfulness-based interventions for chronic pain management...'
              rows={3}
            />
          </FormField>
        </div>
      </section>

      {/* Divider */}
      <div
        class='my-8 h-px'
        style={{ background: tokens.slate200 }}
      />

      {/* Section: Checklist Selection */}
      <section>
        <h2
          class='text-lg font-semibold'
          style={{ color: tokens.slate900 }}
        >
          Quality Assessment Tools
        </h2>
        <p
          class='mt-1 text-sm'
          style={{ color: tokens.slate500 }}
        >
          Select one or more checklists for your reviewers to complete. You can add more later.
        </p>

        <div class='mt-6 grid grid-cols-2 gap-4'>
          <For each={checklistOptions}>
            {checklist => (
              <ChecklistCard
                checklist={checklist}
                selected={selectedChecklists()}
                onToggle={toggleChecklist}
              />
            )}
          </For>
        </div>

        {/* Info callout */}
        <div
          class='mt-4 flex items-start gap-3 rounded-lg p-3'
          style={{ background: tokens.blue50 }}
        >
          <FiInfo
            class='mt-0.5 h-4 w-4 shrink-0'
            style={{ color: tokens.blue600 }}
          />
          <p class='text-sm' style={{ color: tokens.blue700 }}>
            Each study in your review can be assessed using any of the selected checklists.
            Reviewers will see only the tools relevant to their assigned studies.
          </p>
        </div>
      </section>

      {/* Navigation */}
      <div
        class='mt-10 flex items-center justify-between border-t pt-6'
        style={{ 'border-color': tokens.slate200 }}
      >
        <SecondaryButton onClick={props.onCancel}>
          Cancel
        </SecondaryButton>

        <PrimaryButton
          onClick={() => props.onNext?.()}
          disabled={!isValid()}
        >
          Create Project
          <FiChevronRight class='h-4 w-4' />
        </PrimaryButton>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 2: TEAM PANEL
// ============================================================================

/**
 * Avatar component with initials
 */
function Avatar(props) {
  const initials = () => {
    if (props.name) {
      return props.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2);
    }
    return props.email?.[0]?.toUpperCase() || '?';
  };

  // Generate consistent color based on email
  const colorIndex = () => {
    const str = props.email || props.name || '';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 5;
  };

  const colors = [
    { bg: '#dbeafe', text: '#1d4ed8' }, // blue
    { bg: '#d1fae5', text: '#047857' }, // green
    { bg: '#fef3c7', text: '#b45309' }, // amber
    { bg: '#fce7f3', text: '#be185d' }, // pink
    { bg: '#e0e7ff', text: '#4338ca' }, // indigo
  ];

  const color = () => colors[colorIndex()];

  return (
    <div
      class='flex items-center justify-center rounded-full font-medium'
      style={{
        width: props.size || '36px',
        height: props.size || '36px',
        'font-size': props.fontSize || '13px',
        background: color().bg,
        color: color().text,
      }}
    >
      {initials()}
    </div>
  );
}

/**
 * Role badge component
 */
function RoleBadge(props) {
  const isOwner = () => props.role === 'owner';

  return (
    <span
      class='inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium'
      style={{
        background: isOwner() ? tokens.blue100 : tokens.slate100,
        color: isOwner() ? tokens.blue700 : tokens.slate600,
      }}
    >
      {isOwner() ? 'Owner' : 'Member'}
    </span>
  );
}

/**
 * Member row in the team list
 */
function MemberRow(props) {
  const [showMenu, setShowMenu] = createSignal(false);

  return (
    <div
      class='flex items-center justify-between rounded-lg border p-4 transition-colors duration-150'
      style={{
        background: 'white',
        'border-color': tokens.slate200,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = tokens.slate300;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = tokens.slate200;
      }}
    >
      <div class='flex items-center gap-3'>
        <Avatar name={props.member.name} email={props.member.email} />
        <div>
          <p class='text-sm font-medium' style={{ color: tokens.slate900 }}>
            {props.member.name || props.member.email}
          </p>
          <Show when={props.member.name}>
            <p class='text-xs' style={{ color: tokens.slate500 }}>
              {props.member.email}
            </p>
          </Show>
          <Show when={props.member.pending}>
            <p class='mt-0.5 text-xs' style={{ color: tokens.success }}>
              Invite sent
            </p>
          </Show>
        </div>
      </div>

      <div class='flex items-center gap-2'>
        <RoleBadge role={props.member.role} />

        <Show when={!props.member.isCurrentUser}>
          <div class='relative'>
            <button
              class='flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150'
              style={{ color: tokens.slate400 }}
              onClick={() => setShowMenu(!showMenu())}
              onMouseEnter={e => {
                e.currentTarget.style.background = tokens.slate100;
                e.currentTarget.style.color = tokens.slate600;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = tokens.slate400;
              }}
            >
              <FiMoreHorizontal class='h-4 w-4' />
            </button>

            {/* Dropdown menu */}
            <Show when={showMenu()}>
              <div
                class='absolute right-0 z-10 mt-1 w-48 rounded-lg border py-1 shadow-lg'
                style={{
                  background: 'white',
                  'border-color': tokens.slate200,
                }}
              >
                <button
                  class='flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors'
                  style={{ color: tokens.slate700 }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = tokens.slate50;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  onClick={() => {
                    props.onRoleChange?.(props.member.role === 'owner' ? 'member' : 'owner');
                    setShowMenu(false);
                  }}
                >
                  Change to {props.member.role === 'owner' ? 'Member' : 'Owner'}
                </button>
                <button
                  class='flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors'
                  style={{ color: '#dc2626' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#fef2f2';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                  onClick={() => {
                    props.onRemove?.();
                    setShowMenu(false);
                  }}
                >
                  <FiTrash2 class='h-4 w-4' />
                  Remove
                </button>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={props.member.isCurrentUser}>
          <span class='text-xs' style={{ color: tokens.slate400 }}>
            (You)
          </span>
        </Show>
      </div>
    </div>
  );
}

/**
 * Team Panel - Step 2
 * Reusable component for both wizard and project settings
 */
function TeamStep(props) {
  const [emailInput, setEmailInput] = createSignal('');
  const [selectedRole, setSelectedRole] = createSignal('member');
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [members, setMembers] = createSignal([
    // Current user is always first member as owner
    {
      id: 'current',
      name: 'You',
      email: 'you@example.com',
      role: 'owner',
      isCurrentUser: true,
    },
  ]);

  // Filter org members based on input
  const suggestions = createMemo(() => {
    const input = emailInput().toLowerCase();
    if (!input) return [];

    const existingEmails = members().map(m => m.email.toLowerCase());

    return orgMembers.filter(
      m =>
        !existingEmails.includes(m.email.toLowerCase()) &&
        (m.email.toLowerCase().includes(input) || m.name.toLowerCase().includes(input))
    );
  });

  const addMember = (email, name = null) => {
    if (!email) return;

    const existing = members().find(m => m.email.toLowerCase() === email.toLowerCase());
    if (existing) return;

    // Check if this is an org member
    const orgMember = orgMembers.find(m => m.email.toLowerCase() === email.toLowerCase());

    setMembers([
      ...members(),
      {
        id: Date.now().toString(),
        name: name || orgMember?.name || null,
        email: email,
        role: selectedRole(),
        pending: true,
      },
    ]);

    setEmailInput('');
    setShowSuggestions(false);
  };

  const removeMember = id => {
    setMembers(members().filter(m => m.id !== id));
  };

  const changeRole = (id, newRole) => {
    setMembers(members().map(m => (m.id === id ? { ...m, role: newRole } : m)));
  };

  const memberCount = createMemo(() => members().length);
  const hasEnoughForDualReview = createMemo(() => memberCount() >= 2);

  return (
    <div class='mx-auto max-w-3xl'>
      {/* Header */}
      <section>
        <h2 class='text-lg font-semibold' style={{ color: tokens.slate900 }}>
          Team Members
        </h2>
        <p class='mt-1 text-sm' style={{ color: tokens.slate500 }}>
          Add collaborators to your project. Invites are sent immediately when you add members.
        </p>
      </section>

      {/* Add member form */}
      <div class='mt-6'>
        <div class='flex gap-3'>
          <div class='relative flex-1'>
            <div class='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2'>
              <FiMail class='h-4 w-4' style={{ color: tokens.slate400 }} />
            </div>
            <input
              type='email'
              value={emailInput()}
              onInput={e => {
                setEmailInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={e => {
                if (e.key === 'Enter' && emailInput()) {
                  e.preventDefault();
                  addMember(emailInput());
                }
              }}
              placeholder='Email address or name'
              class='w-full rounded-lg border py-2.5 pr-3 pl-10 text-sm transition-all duration-200 outline-none'
              style={{
                'border-color': tokens.slate200,
                background: 'white',
                color: tokens.slate900,
              }}
              onFocus={e => {
                e.target.style.borderColor = tokens.blue500;
                e.target.style.boxShadow = `0 0 0 3px ${tokens.blue100}`;
              }}
              onBlur={e => {
                e.target.style.borderColor = tokens.slate200;
                e.target.style.boxShadow = 'none';
                // Delay hiding suggestions to allow click
                setTimeout(() => setShowSuggestions(false), 150);
              }}
            />

            {/* Autocomplete suggestions */}
            <Show when={showSuggestions() && suggestions().length > 0}>
              <div
                class='absolute top-full right-0 left-0 z-20 mt-1 rounded-lg border shadow-lg'
                style={{ background: 'white', 'border-color': tokens.slate200 }}
              >
                <For each={suggestions()}>
                  {member => (
                    <button
                      class='flex w-full items-center gap-3 px-3 py-2 text-left transition-colors first:rounded-t-lg last:rounded-b-lg'
                      style={{ color: tokens.slate700 }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = tokens.slate50;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                      onMouseDown={e => {
                        e.preventDefault();
                        addMember(member.email, member.name);
                      }}
                    >
                      <Avatar name={member.name} email={member.email} size='32px' fontSize='11px' />
                      <div>
                        <p class='text-sm font-medium'>{member.name}</p>
                        <p class='text-xs' style={{ color: tokens.slate500 }}>
                          {member.email}
                        </p>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

          {/* Role selector */}
          <select
            value={selectedRole()}
            onChange={e => setSelectedRole(e.target.value)}
            class='rounded-lg border px-3 py-2.5 text-sm outline-none transition-all duration-200'
            style={{
              'border-color': tokens.slate200,
              background: 'white',
              color: tokens.slate700,
              cursor: 'pointer',
            }}
            onFocus={e => {
              e.target.style.borderColor = tokens.blue500;
              e.target.style.boxShadow = `0 0 0 3px ${tokens.blue100}`;
            }}
            onBlur={e => {
              e.target.style.borderColor = tokens.slate200;
              e.target.style.boxShadow = 'none';
            }}
          >
            <option value='member'>Member</option>
            <option value='owner'>Owner</option>
          </select>

          {/* Add button */}
          <button
            onClick={() => addMember(emailInput())}
            disabled={!emailInput()}
            class='flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200'
            style={{
              background: emailInput() ? tokens.blue600 : tokens.slate100,
              color: emailInput() ? 'white' : tokens.slate400,
              cursor: emailInput() ? 'pointer' : 'not-allowed',
            }}
            onMouseEnter={e => {
              if (emailInput()) e.currentTarget.style.background = tokens.blue700;
            }}
            onMouseLeave={e => {
              if (emailInput()) e.currentTarget.style.background = tokens.blue600;
            }}
          >
            <FiUserPlus class='h-4 w-4' />
            Add
          </button>
        </div>
      </div>

      {/* Warning for single reviewer */}
      <Show when={!hasEnoughForDualReview()}>
        <div
          class='mt-4 flex items-start gap-3 rounded-lg border p-3'
          style={{ background: '#fffbeb', 'border-color': '#fcd34d' }}
        >
          <FiAlertCircle class='mt-0.5 h-4 w-4 shrink-0' style={{ color: '#b45309' }} />
          <p class='text-sm' style={{ color: '#92400e' }}>
            Dual-review requires at least 2 team members. Add another member to enable independent review.
          </p>
        </div>
      </Show>

      {/* Member list */}
      <div class='mt-6 space-y-2'>
        <div class='flex items-center justify-between'>
          <h3 class='text-sm font-medium' style={{ color: tokens.slate700 }}>
            Team ({memberCount()})
          </h3>
        </div>

        <div class='space-y-2'>
          <For each={members()}>
            {member => (
              <MemberRow
                member={member}
                onRemove={() => removeMember(member.id)}
                onRoleChange={newRole => changeRole(member.id, newRole)}
              />
            )}
          </For>
        </div>
      </div>

      {/* Info callout */}
      <div class='mt-6 flex items-start gap-3 rounded-lg p-3' style={{ background: tokens.blue50 }}>
        <FiInfo class='mt-0.5 h-4 w-4 shrink-0' style={{ color: tokens.blue600 }} />
        <p class='text-sm' style={{ color: tokens.blue700 }}>
          You can add more team members at any time from the project settings.
        </p>
      </div>

      {/* Navigation */}
      <div
        class='mt-10 flex items-center justify-between border-t pt-6'
        style={{ 'border-color': tokens.slate200 }}
      >
        <SecondaryButton onClick={props.onBack}>
          <FiChevronLeft class='h-4 w-4' />
          Back
        </SecondaryButton>

        <div class='flex items-center gap-3'>
          <SecondaryButton onClick={props.onSkip}>Skip for now</SecondaryButton>

          <PrimaryButton onClick={props.onNext}>
            Continue
            <FiChevronRight class='h-4 w-4' />
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 3: STUDIES IMPORT PANEL
// ============================================================================

/**
 * Tab button for import sources
 */
function ImportTab(props) {
  return (
    <button
      type='button'
      onClick={props.onClick}
      class='flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-all duration-200'
      style={{
        'border-color': props.active ? tokens.blue600 : 'transparent',
        color: props.active ? tokens.blue700 : tokens.slate500,
        background: props.active ? tokens.blue50 : 'transparent',
      }}
      onMouseEnter={e => {
        if (!props.active) {
          e.currentTarget.style.color = tokens.slate700;
          e.currentTarget.style.background = tokens.slate50;
        }
      }}
      onMouseLeave={e => {
        if (!props.active) {
          e.currentTarget.style.color = tokens.slate500;
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

/**
 * Study card in the staging area
 */
function StudyCard(props) {
  return (
    <div
      class='group flex items-start gap-3 rounded-lg border p-4 transition-all duration-150'
      style={{
        background: 'white',
        'border-color': props.duplicate ? '#fcd34d' : tokens.slate200,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = props.duplicate ? '#f59e0b' : tokens.slate300;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = props.duplicate ? '#fcd34d' : tokens.slate200;
      }}
    >
      {/* PDF indicator */}
      <div
        class='mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'
        style={{
          background: props.study.hasPdf ? tokens.blue50 : tokens.slate100,
          color: props.study.hasPdf ? tokens.blue600 : tokens.slate400,
        }}
      >
        <Show when={props.study.hasPdf} fallback={<FiFileText class='h-5 w-5' />}>
          <FiFile class='h-5 w-5' />
        </Show>
      </div>

      {/* Study info */}
      <div class='min-w-0 flex-1'>
        <p class='text-sm font-medium leading-snug' style={{ color: tokens.slate900 }}>
          {props.study.title}
        </p>
        <p class='mt-1 truncate text-xs' style={{ color: tokens.slate500 }}>
          {props.study.authors}
        </p>
        <div class='mt-2 flex flex-wrap items-center gap-2'>
          <Show when={props.study.journal}>
            <span class='text-xs' style={{ color: tokens.slate400 }}>
              {props.study.journal}
            </span>
          </Show>
          <Show when={props.study.year}>
            <span class='text-xs' style={{ color: tokens.slate400 }}>
              ({props.study.year})
            </span>
          </Show>
          <Show when={props.study.doi}>
            <span
              class='inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs'
              style={{ background: tokens.slate100, color: tokens.slate600 }}
            >
              DOI
            </span>
          </Show>
          <Show when={props.study.hasPdf}>
            <span
              class='inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs'
              style={{ background: tokens.blue50, color: tokens.blue700 }}
            >
              <FiFile class='h-3 w-3' />
              PDF
            </span>
          </Show>
          <Show when={props.duplicate}>
            <span
              class='inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs'
              style={{ background: '#fef3c7', color: '#b45309' }}
            >
              <FiAlertCircle class='h-3 w-3' />
              Possible duplicate
            </span>
          </Show>
        </div>
      </div>

      {/* Actions */}
      <button
        class='shrink-0 rounded-lg p-1.5 opacity-0 transition-all duration-150 group-hover:opacity-100'
        style={{ color: tokens.slate400 }}
        onClick={() => props.onRemove?.()}
        onMouseEnter={e => {
          e.currentTarget.style.background = '#fef2f2';
          e.currentTarget.style.color = '#dc2626';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = tokens.slate400;
        }}
      >
        <FiX class='h-4 w-4' />
      </button>
    </div>
  );
}

/**
 * PDF Upload Tab Content
 */
function PdfUploadTab(props) {
  const [isDragging, setIsDragging] = createSignal(false);

  return (
    <div class='space-y-4'>
      {/* Drop zone */}
      <div
        class='relative rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200'
        style={{
          'border-color': isDragging() ? tokens.blue500 : tokens.slate200,
          background: isDragging() ? tokens.blue50 : tokens.slate50,
        }}
        onDragOver={e => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          // Mock: simulate adding files
          props.onUpload?.();
        }}
      >
        <div
          class='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full'
          style={{ background: tokens.blue100, color: tokens.blue600 }}
        >
          <FiUpload class='h-6 w-6' />
        </div>
        <p class='text-sm font-medium' style={{ color: tokens.slate700 }}>
          Drag and drop PDF files here
        </p>
        <p class='mt-1 text-xs' style={{ color: tokens.slate500 }}>
          or click to browse
        </p>
        <input
          type='file'
          accept='.pdf'
          multiple
          class='absolute inset-0 cursor-pointer opacity-0'
          onChange={() => props.onUpload?.()}
        />
      </div>

      <p class='text-center text-xs' style={{ color: tokens.slate400 }}>
        Metadata will be automatically extracted from uploaded PDFs
      </p>
    </div>
  );
}

/**
 * DOI/PMID Lookup Tab Content
 */
function DoiLookupTab(props) {
  const [input, setInput] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);

  const handleLookup = () => {
    if (!input()) return;
    setIsLoading(true);
    // Mock: simulate lookup delay
    setTimeout(() => {
      setIsLoading(false);
      props.onLookup?.(input());
      setInput('');
    }, 800);
  };

  return (
    <div class='space-y-4'>
      <div>
        <label class='mb-1.5 block text-sm font-medium' style={{ color: tokens.slate700 }}>
          Enter DOIs or PMIDs
        </label>
        <textarea
          value={input()}
          onInput={e => setInput(e.target.value)}
          placeholder='10.1001/jama.2016.0086&#10;10.3389/fpsyg.2016.00578&#10;PMID: 27002445'
          rows={4}
          class='w-full resize-none rounded-lg border px-3 py-2.5 text-sm transition-all duration-200 outline-none'
          style={{
            'border-color': tokens.slate200,
            background: 'white',
            color: tokens.slate900,
          }}
          onFocus={e => {
            e.target.style.borderColor = tokens.blue500;
            e.target.style.boxShadow = `0 0 0 3px ${tokens.blue100}`;
          }}
          onBlur={e => {
            e.target.style.borderColor = tokens.slate200;
            e.target.style.boxShadow = 'none';
          }}
        />
        <p class='mt-1.5 text-xs' style={{ color: tokens.slate500 }}>
          One identifier per line. Supports DOI (10.xxxx/...) and PMID formats.
        </p>
      </div>

      <button
        onClick={handleLookup}
        disabled={!input() || isLoading()}
        class='flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200'
        style={{
          background: input() && !isLoading() ? tokens.blue600 : tokens.slate100,
          color: input() && !isLoading() ? 'white' : tokens.slate400,
          cursor: input() && !isLoading() ? 'pointer' : 'not-allowed',
        }}
      >
        <Show when={isLoading()} fallback={<FiSearch class='h-4 w-4' />}>
          <div
            class='h-4 w-4 animate-spin rounded-full border-2'
            style={{ 'border-color': `${tokens.slate300} transparent transparent transparent` }}
          />
        </Show>
        {isLoading() ? 'Looking up...' : 'Look up metadata'}
      </button>
    </div>
  );
}

/**
 * Reference File Import Tab Content
 */
function ReferenceFileTab(props) {
  return (
    <div class='space-y-4'>
      <div
        class='relative rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200'
        style={{
          'border-color': tokens.slate200,
          background: tokens.slate50,
        }}
      >
        <div
          class='mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full'
          style={{ background: tokens.slate200, color: tokens.slate500 }}
        >
          <FiFileText class='h-5 w-5' />
        </div>
        <p class='text-sm font-medium' style={{ color: tokens.slate700 }}>
          Upload reference file
        </p>
        <p class='mt-1 text-xs' style={{ color: tokens.slate500 }}>
          RIS, BibTeX, EndNote XML, or CSV
        </p>
        <input
          type='file'
          accept='.ris,.bib,.xml,.csv'
          class='absolute inset-0 cursor-pointer opacity-0'
          onChange={() => props.onUpload?.()}
        />
      </div>

      <div class='flex items-center gap-3'>
        <div class='h-px flex-1' style={{ background: tokens.slate200 }} />
        <span class='text-xs' style={{ color: tokens.slate400 }}>
          Supported formats
        </span>
        <div class='h-px flex-1' style={{ background: tokens.slate200 }} />
      </div>

      <div class='grid grid-cols-4 gap-2'>
        {[
          { name: 'RIS', desc: 'Research Info Systems' },
          { name: 'BibTeX', desc: 'LaTeX bibliography' },
          { name: 'EndNote', desc: 'XML export' },
          { name: 'CSV', desc: 'Spreadsheet' },
        ].map(format => (
          <div
            class='rounded-lg border p-3 text-center'
            style={{ 'border-color': tokens.slate200, background: 'white' }}
          >
            <p class='text-sm font-medium' style={{ color: tokens.slate700 }}>
              {format.name}
            </p>
            <p class='mt-0.5 text-xs' style={{ color: tokens.slate400 }}>
              {format.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Google Drive Tab Content
 */
function GoogleDriveTab(props) {
  const [isConnected, setIsConnected] = createSignal(false);

  return (
    <div class='space-y-4'>
      <Show
        when={isConnected()}
        fallback={
          <div class='rounded-xl border p-6 text-center' style={{ 'border-color': tokens.slate200 }}>
            <div
              class='mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full'
              style={{ background: '#fef3c7', color: '#b45309' }}
            >
              <FiFolder class='h-6 w-6' />
            </div>
            <p class='text-sm font-medium' style={{ color: tokens.slate700 }}>
              Connect Google Drive
            </p>
            <p class='mx-auto mt-1 max-w-xs text-xs' style={{ color: tokens.slate500 }}>
              Import PDFs directly from your Google Drive folders
            </p>
            <button
              onClick={() => setIsConnected(true)}
              class='mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200'
              style={{ background: tokens.blue600, color: 'white' }}
              onMouseEnter={e => {
                e.currentTarget.style.background = tokens.blue700;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = tokens.blue600;
              }}
            >
              <FiExternalLink class='h-4 w-4' />
              Connect Drive
            </button>
          </div>
        }
      >
        {/* Connected state - file browser mock */}
        <div class='rounded-xl border' style={{ 'border-color': tokens.slate200 }}>
          <div
            class='flex items-center justify-between border-b px-4 py-3'
            style={{ 'border-color': tokens.slate200, background: tokens.slate50 }}
          >
            <div class='flex items-center gap-2'>
              <FiFolder class='h-4 w-4' style={{ color: tokens.slate500 }} />
              <span class='text-sm font-medium' style={{ color: tokens.slate700 }}>
                My Drive / Research Papers
              </span>
            </div>
            <button
              class='text-xs'
              style={{ color: tokens.blue600 }}
              onClick={() => setIsConnected(false)}
            >
              Disconnect
            </button>
          </div>
          <div class='divide-y' style={{ 'border-color': tokens.slate100 }}>
            {[
              { name: 'Cherkin_2016_JAMA.pdf', selected: true },
              { name: 'deJong_2016_FrontPsych.pdf', selected: true },
              { name: 'Schmidt_2020_PainMed.pdf', selected: false },
              { name: 'Gardner_2021_JPainRes.pdf', selected: false },
            ].map(file => (
              <div
                class='flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors'
                style={{ background: file.selected ? tokens.blue50 : 'white' }}
              >
                <input
                  type='checkbox'
                  checked={file.selected}
                  class='h-4 w-4 rounded'
                  style={{ accentColor: tokens.blue600 }}
                />
                <FiFile class='h-4 w-4' style={{ color: tokens.slate400 }} />
                <span class='text-sm' style={{ color: tokens.slate700 }}>
                  {file.name}
                </span>
              </div>
            ))}
          </div>
          <div
            class='flex items-center justify-between border-t px-4 py-3'
            style={{ 'border-color': tokens.slate200, background: tokens.slate50 }}
          >
            <span class='text-xs' style={{ color: tokens.slate500 }}>
              2 files selected
            </span>
            <button
              class='rounded-lg px-3 py-1.5 text-sm font-medium'
              style={{ background: tokens.blue600, color: 'white' }}
              onClick={() => props.onImport?.()}
            >
              Import Selected
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}

/**
 * Studies Import Panel - Step 3
 * Reusable component for both wizard and studies tab
 */
function StudiesStep(props) {
  const [activeTab, setActiveTab] = createSignal('pdf');
  const [studies, setStudies] = createSignal([]);

  // Mock: add sample studies
  const addMockStudies = () => {
    const newStudies = [
      {
        id: Date.now().toString(),
        title: 'Mindfulness-Based Stress Reduction for Chronic Low Back Pain: A Randomized Controlled Trial',
        authors: 'Cherkin DC, Sherman KJ, Balderson BH, et al.',
        journal: 'JAMA',
        year: 2016,
        doi: '10.1001/jama.2016.0086',
        hasPdf: true,
      },
      {
        id: (Date.now() + 1).toString(),
        title: 'Effects of Mindfulness-Based Cognitive Therapy on Body Awareness in Patients with Chronic Pain',
        authors: 'de Jong M, Lazar SW, Hug K, et al.',
        journal: 'Frontiers in Psychology',
        year: 2016,
        doi: '10.3389/fpsyg.2016.00578',
        hasPdf: true,
      },
    ];
    setStudies([...studies(), ...newStudies]);
  };

  const addDoiStudy = () => {
    const newStudy = {
      id: Date.now().toString(),
      title: 'A Pilot Study of Mindfulness Meditation for Pediatric Chronic Pain',
      authors: 'Jastrowski Mano KE, Salamon KS, Hainsworth KR, et al.',
      journal: 'Children',
      year: 2019,
      doi: '10.3390/children6010007',
      hasPdf: false,
    };
    setStudies([...studies(), newStudy]);
  };

  const removeStudy = id => {
    setStudies(studies().filter(s => s.id !== id));
  };

  const studyCount = createMemo(() => studies().length);
  const pdfCount = createMemo(() => studies().filter(s => s.hasPdf).length);

  // Check for duplicates (mock: just check by title similarity)
  const isDuplicate = study => {
    const otherStudies = studies().filter(s => s.id !== study.id);
    return otherStudies.some(s =>
      s.title.toLowerCase().includes(study.title.split(':')[0].toLowerCase().trim())
    );
  };

  return (
    <div class='mx-auto max-w-3xl'>
      {/* Header */}
      <section>
        <h2 class='text-lg font-semibold' style={{ color: tokens.slate900 }}>
          Import Studies
        </h2>
        <p class='mt-1 text-sm' style={{ color: tokens.slate500 }}>
          Add studies from PDFs, identifiers, reference files, or Google Drive.
        </p>
      </section>

      {/* Import tabs */}
      <div class='mt-6'>
        <div
          class='flex border-b'
          style={{ 'border-color': tokens.slate200 }}
        >
          <ImportTab
            label='PDF Upload'
            icon={<FiUpload class='h-4 w-4' />}
            active={activeTab() === 'pdf'}
            onClick={() => setActiveTab('pdf')}
          />
          <ImportTab
            label='DOI / PMID'
            icon={<FiSearch class='h-4 w-4' />}
            active={activeTab() === 'doi'}
            onClick={() => setActiveTab('doi')}
          />
          <ImportTab
            label='Reference File'
            icon={<FiFileText class='h-4 w-4' />}
            active={activeTab() === 'reference'}
            onClick={() => setActiveTab('reference')}
          />
          <ImportTab
            label='Google Drive'
            icon={<FiFolder class='h-4 w-4' />}
            active={activeTab() === 'drive'}
            onClick={() => setActiveTab('drive')}
          />
        </div>

        <div class='py-6'>
          <Show when={activeTab() === 'pdf'}>
            <PdfUploadTab onUpload={addMockStudies} />
          </Show>
          <Show when={activeTab() === 'doi'}>
            <DoiLookupTab onLookup={addDoiStudy} />
          </Show>
          <Show when={activeTab() === 'reference'}>
            <ReferenceFileTab onUpload={addMockStudies} />
          </Show>
          <Show when={activeTab() === 'drive'}>
            <GoogleDriveTab onImport={addMockStudies} />
          </Show>
        </div>
      </div>

      {/* Staging area */}
      <Show when={studies().length > 0}>
        <section class='mt-2'>
          <div class='mb-3 flex items-center justify-between'>
            <h3 class='text-sm font-medium' style={{ color: tokens.slate700 }}>
              Imported Studies ({studyCount()})
            </h3>
            <div class='flex items-center gap-3'>
              <span class='text-xs' style={{ color: tokens.slate500 }}>
                {pdfCount()} with PDF
              </span>
              <Show when={studyCount() - pdfCount() > 0}>
                <span class='text-xs' style={{ color: '#b45309' }}>
                  {studyCount() - pdfCount()} missing PDF
                </span>
              </Show>
            </div>
          </div>

          <div class='space-y-2'>
            <For each={studies()}>
              {study => (
                <StudyCard
                  study={study}
                  duplicate={isDuplicate(study)}
                  onRemove={() => removeStudy(study.id)}
                />
              )}
            </For>
          </div>
        </section>
      </Show>

      {/* Empty state */}
      <Show when={studies().length === 0}>
        <div
          class='mt-2 rounded-xl border-2 border-dashed p-8 text-center'
          style={{ 'border-color': tokens.slate200 }}
        >
          <div
            class='mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full'
            style={{ background: tokens.slate100, color: tokens.slate400 }}
          >
            <FiFileText class='h-5 w-5' />
          </div>
          <p class='text-sm font-medium' style={{ color: tokens.slate600 }}>
            No studies imported yet
          </p>
          <p class='mt-1 text-xs' style={{ color: tokens.slate400 }}>
            Use the tabs above to add studies to your project
          </p>
        </div>
      </Show>

      {/* Info callout */}
      <div class='mt-6 flex items-start gap-3 rounded-lg p-3' style={{ background: tokens.blue50 }}>
        <FiInfo class='mt-0.5 h-4 w-4 shrink-0' style={{ color: tokens.blue600 }} />
        <p class='text-sm' style={{ color: tokens.blue700 }}>
          You can import more studies at any time from the Studies tab.
        </p>
      </div>

      {/* Navigation */}
      <div
        class='mt-10 flex items-center justify-between border-t pt-6'
        style={{ 'border-color': tokens.slate200 }}
      >
        <SecondaryButton onClick={props.onBack}>
          <FiChevronLeft class='h-4 w-4' />
          Back
        </SecondaryButton>

        <div class='flex items-center gap-3'>
          <SecondaryButton onClick={props.onSkip}>Skip for now</SecondaryButton>

          <PrimaryButton onClick={props.onNext}>
            Continue
            <FiChevronRight class='h-4 w-4' />
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 4: ASSIGNMENT PANEL
// ============================================================================

const PERCENT_PRESETS = [0, 25, 33, 50, 75, 100];

/**
 * Preset button for percentage selection
 */
function PresetButton(props) {
  return (
    <button
      type='button'
      onClick={props.onClick}
      class='rounded-md px-2 py-1 text-xs font-medium transition-all'
      style={{
        background: props.active ? tokens.blue600 : tokens.slate100,
        color: props.active ? 'white' : tokens.slate600,
      }}
      onMouseEnter={e => {
        if (!props.active) e.currentTarget.style.background = tokens.slate200;
      }}
      onMouseLeave={e => {
        if (!props.active) e.currentTarget.style.background = tokens.slate100;
      }}
    >
      {props.value}%
    </button>
  );
}

/**
 * Member row with percentage presets for customization
 */
function MemberPercentRow(props) {
  return (
    <div
      class='flex items-center gap-3 rounded-lg border p-3'
      style={{ background: 'white', 'border-color': tokens.slate200 }}
    >
      <Avatar name={props.member.name} email={props.member.email} size='32px' fontSize='11px' />
      <div class='min-w-0 flex-1'>
        <p class='truncate text-sm font-medium' style={{ color: tokens.slate700 }}>
          {props.member.name}
        </p>
      </div>
      <div class='flex items-center gap-1'>
        <For each={PERCENT_PRESETS}>
          {preset => (
            <PresetButton
              value={preset}
              active={props.percent === preset}
              onClick={() => props.onChange(preset)}
            />
          )}
        </For>
      </div>
    </div>
  );
}

/**
 * Assignment preview table row
 */
function PreviewRow(props) {
  const hasConflict = () => props.assignment.reviewer1?.id === props.assignment.reviewer2?.id;
  const isEven = () => props.index % 2 === 0;

  // Background: conflict (red) > even row (light gray) > transparent
  const rowBg = () => {
    if (hasConflict()) return '#fef2f2';
    if (isEven()) return tokens.slate50;
    return 'white';
  };

  return (
    <tr style={{ background: rowBg() }}>
      <td class='max-w-xs truncate py-2.5 pr-4 pl-4 text-sm' style={{ color: tokens.slate700 }}>
        {props.assignment.title}
      </td>
      <td class='py-2.5 pr-4'>
        <Show when={props.assignment.reviewer1}>
          <div class='flex items-center gap-2'>
            <Avatar
              name={props.assignment.reviewer1.name}
              email={props.assignment.reviewer1.email}
              size='22px'
              fontSize='8px'
            />
            <span class='text-sm' style={{ color: tokens.slate600 }}>
              {props.assignment.reviewer1.name}
            </span>
          </div>
        </Show>
      </td>
      <td class='py-2.5 pr-4'>
        <Show when={props.assignment.reviewer2}>
          <div class='flex items-center gap-2'>
            <Avatar
              name={props.assignment.reviewer2.name}
              email={props.assignment.reviewer2.email}
              size='22px'
              fontSize='8px'
            />
            <span
              class='text-sm'
              style={{ color: hasConflict() ? '#dc2626' : tokens.slate600 }}
            >
              {props.assignment.reviewer2.name}
              {hasConflict() && ' (conflict)'}
            </span>
          </div>
        </Show>
      </td>
    </tr>
  );
}

/**
 * Assignment Panel - Step 4
 * Simple one-click assignment with optional customization
 */
function AssignmentStep(props) {
  // Mock team members
  const allMembers = [
    { id: '1', name: 'You', email: 'you@example.com' },
    { id: '2', name: 'Dr. Sarah Chen', email: 'sarah.chen@university.edu' },
    { id: '3', name: 'Dr. Michael Torres', email: 'm.torres@research.org' },
    { id: '4', name: 'Dr. Emily Watson', email: 'e.watson@institute.edu' },
  ];

  // Mock studies
  const studies = [
    { id: '1', title: 'Mindfulness-Based Stress Reduction for Chronic Low Back Pain' },
    { id: '2', title: 'Effects of Mindfulness-Based Cognitive Therapy on Body Awareness' },
    { id: '3', title: 'A Pilot Study of Mindfulness Meditation for Pediatric Chronic Pain' },
    { id: '4', title: 'Mindfulness Training for Coping with Chronic Pain' },
    { id: '5', title: 'Acceptance-Based Interventions for Fibromyalgia' },
    { id: '6', title: 'Yoga as a Treatment for Chronic Low Back Pain' },
  ];

  // Custom percentages per member per pool (null = use even split)
  const [pool1Percents, setPool1Percents] = createSignal(null);
  const [pool2Percents, setPool2Percents] = createSignal(null);

  // UI state
  const [showCustomize, setShowCustomize] = createSignal(false);
  const [previewAssignments, setPreviewAssignments] = createSignal([]);

  const hasAssignments = () => previewAssignments().length > 0;

  // Get effective percentages
  const getEvenPercents = () => {
    const each = Math.floor(100 / allMembers.length);
    const remainder = 100 - each * allMembers.length;
    const result = {};
    allMembers.forEach((m, i) => {
      result[m.id] = each + (i < remainder ? 1 : 0);
    });
    return result;
  };

  const getPool1Percents = () => pool1Percents() || getEvenPercents();
  const getPool2Percents = () => pool2Percents() || getEvenPercents();

  // Update custom percentage
  const updatePool1Percent = (id, value) => {
    const current = pool1Percents() || getEvenPercents();
    setPool1Percents({ ...current, [id]: value });
  };

  const updatePool2Percent = (id, value) => {
    const current = pool2Percents() || getEvenPercents();
    setPool2Percents({ ...current, [id]: value });
  };

  // Totals for validation (allow 99-100% for rounding cases like 3x33%)
  const pool1Total = () => Object.values(getPool1Percents()).reduce((a, b) => a + b, 0);
  const pool2Total = () => Object.values(getPool2Percents()).reduce((a, b) => a + b, 0);
  const isPoolValid = total => total >= 99 && total <= 100;
  const isCustomValid = () => isPoolValid(pool1Total()) && isPoolValid(pool2Total());

  // Shuffle array
  const shuffleArray = arr => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Generate assignments
  const generateAssignments = () => {
    const totalStudies = studies.length;
    const p1Percents = getPool1Percents();
    const p2Percents = getPool2Percents();

    // Build assignment arrays based on percentages
    const pool1Assignments = [];
    const pool2Assignments = [];

    // Only include members with > 0%
    const p1Members = allMembers.filter(m => (p1Percents[m.id] || 0) > 0);
    const p2Members = allMembers.filter(m => (p2Percents[m.id] || 0) > 0);

    let remaining1 = totalStudies;
    p1Members.forEach((m, i) => {
      const percent = p1Percents[m.id] || 0;
      const count = i === p1Members.length - 1 ? remaining1 : Math.round((percent / 100) * totalStudies);
      remaining1 -= count;
      for (let j = 0; j < count; j++) pool1Assignments.push(m);
    });

    let remaining2 = totalStudies;
    p2Members.forEach((m, i) => {
      const percent = p2Percents[m.id] || 0;
      const count = i === p2Members.length - 1 ? remaining2 : Math.round((percent / 100) * totalStudies);
      remaining2 -= count;
      for (let j = 0; j < count; j++) pool2Assignments.push(m);
    });

    // Shuffle and assign
    const shuffled1 = shuffleArray(pool1Assignments);
    const shuffled2 = shuffleArray(pool2Assignments);
    const shuffledStudies = shuffleArray(studies);

    const assignments = shuffledStudies.map((study, i) => ({
      ...study,
      reviewer1: shuffled1[i],
      reviewer2: shuffled2[i],
    }));

    // Resolve conflicts by swapping
    for (let i = 0; i < assignments.length; i++) {
      if (assignments[i].reviewer1?.id === assignments[i].reviewer2?.id) {
        for (let j = 0; j < assignments.length; j++) {
          if (i !== j && assignments[j].reviewer1?.id !== assignments[j].reviewer2?.id) {
            const canSwap =
              assignments[j].reviewer2?.id !== assignments[i].reviewer1?.id &&
              assignments[i].reviewer2?.id !== assignments[j].reviewer1?.id;
            if (canSwap) {
              const temp = assignments[i].reviewer2;
              assignments[i].reviewer2 = assignments[j].reviewer2;
              assignments[j].reviewer2 = temp;
              break;
            }
          }
        }
      }
    }

    setPreviewAssignments(assignments);
  };

  const hasConflicts = createMemo(() =>
    previewAssignments().some(a => a.reviewer1?.id === a.reviewer2?.id)
  );

  const conflictCount = createMemo(() =>
    previewAssignments().filter(a => a.reviewer1?.id === a.reviewer2?.id).length
  );

  // Get member data with current percentages
  const pool1MembersWithPercent = createMemo(() =>
    allMembers.map(m => ({ ...m, percent: getPool1Percents()[m.id] || 0 }))
  );

  const pool2MembersWithPercent = createMemo(() =>
    allMembers.map(m => ({ ...m, percent: getPool2Percents()[m.id] || 0 }))
  );

  return (
    <div class='mx-auto max-w-3xl'>
      {/* Header */}
      <section>
        <h2 class='text-lg font-semibold' style={{ color: tokens.slate900 }}>
          Reviewer Assignment
        </h2>
        <p class='mt-1 text-sm' style={{ color: tokens.slate500 }}>
          Randomly assign studies to reviewers. By default, work is split evenly among all team members.
        </p>
      </section>

      {/* Summary */}
      <div
        class='mt-4 flex items-center justify-between rounded-lg px-4 py-3'
        style={{ background: tokens.slate100 }}
      >
        <p class='text-sm' style={{ color: tokens.slate600 }}>
          <span class='font-semibold' style={{ color: tokens.slate900 }}>{studies.length}</span> studies
        </p>
        <p class='text-sm' style={{ color: tokens.slate600 }}>
          <span class='font-semibold' style={{ color: tokens.slate900 }}>{allMembers.length}</span> reviewers
        </p>
        <p class='text-sm' style={{ color: tokens.slate600 }}>
          <span class='font-semibold' style={{ color: tokens.slate900 }}>
            {Math.round(100 / allMembers.length)}%
          </span> each (even split)
        </p>
      </div>

      {/* Customize toggle */}
      <button
        onClick={() => setShowCustomize(!showCustomize())}
        class='mt-6 flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm font-medium transition-all'
        style={{
          'border-color': showCustomize() ? tokens.blue300 : tokens.slate200,
          background: showCustomize() ? tokens.blue50 : 'white',
          color: showCustomize() ? tokens.blue700 : tokens.slate700,
        }}
        onMouseEnter={e => {
          if (!showCustomize()) {
            e.currentTarget.style.borderColor = tokens.slate300;
            e.currentTarget.style.background = tokens.slate50;
          }
        }}
        onMouseLeave={e => {
          if (!showCustomize()) {
            e.currentTarget.style.borderColor = tokens.slate200;
            e.currentTarget.style.background = 'white';
          }
        }}
      >
        <div class='flex items-center gap-2'>
          <FiSliders class='h-4 w-4' />
          <span>Customize distribution</span>
        </div>
        <div class='flex items-center gap-2'>
          <span class='text-xs' style={{ color: tokens.slate400 }}>
            {showCustomize() ? 'Hide' : 'Adjust percentages per reviewer'}
          </span>
          <FiChevronRight
            class='h-4 w-4 transition-transform'
            style={{ transform: showCustomize() ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
        </div>
      </button>

      {/* Customization panels */}
      <Show when={showCustomize()}>
        <div class='mt-4 space-y-4'>
          {/* Pool 1 */}
          <div
            class='rounded-xl border p-4'
            style={{ 'border-color': tokens.slate200, background: tokens.slate50 }}
          >
            <div class='mb-3 flex items-center justify-between'>
              <h4 class='text-sm font-semibold' style={{ color: tokens.slate700 }}>
                1st Reviewer Pool
              </h4>
              <span
                class='text-xs font-medium'
                style={{ color: isPoolValid(pool1Total()) ? tokens.success : '#b45309' }}
              >
                Total: {pool1Total()}%{pool1Total() === 99 && ' (OK)'}
              </span>
            </div>
            <div class='space-y-2'>
              <For each={pool1MembersWithPercent()}>
                {member => (
                  <MemberPercentRow
                    member={member}
                    percent={member.percent}
                    onChange={val => updatePool1Percent(member.id, val)}
                  />
                )}
              </For>
            </div>
          </div>

          {/* Pool 2 */}
          <div
            class='rounded-xl border p-4'
            style={{ 'border-color': tokens.slate200, background: tokens.slate50 }}
          >
            <div class='mb-3 flex items-center justify-between'>
              <h4 class='text-sm font-semibold' style={{ color: tokens.slate700 }}>
                2nd Reviewer Pool
              </h4>
              <span
                class='text-xs font-medium'
                style={{ color: isPoolValid(pool2Total()) ? tokens.success : '#b45309' }}
              >
                Total: {pool2Total()}%{pool2Total() === 99 && ' (OK)'}
              </span>
            </div>
            <div class='space-y-2'>
              <For each={pool2MembersWithPercent()}>
                {member => (
                  <MemberPercentRow
                    member={member}
                    percent={member.percent}
                    onChange={val => updatePool2Percent(member.id, val)}
                  />
                )}
              </For>
            </div>
          </div>

          <Show when={!isCustomValid()}>
            <p class='text-center text-xs' style={{ color: '#b45309' }}>
              Each pool must total 99-100% to generate assignments
            </p>
          </Show>
        </div>
      </Show>

      {/* Action button - below customize */}
      <div class='mt-6'>
        <button
          onClick={generateAssignments}
          disabled={showCustomize() && !isCustomValid()}
          class='flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-200'
          style={{
            background: (showCustomize() && !isCustomValid()) ? tokens.slate200 : tokens.blue600,
            color: (showCustomize() && !isCustomValid()) ? tokens.slate400 : 'white',
            cursor: (showCustomize() && !isCustomValid()) ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={e => {
            if (!showCustomize() || isCustomValid()) e.currentTarget.style.background = tokens.blue700;
          }}
          onMouseLeave={e => {
            if (!showCustomize() || isCustomValid()) e.currentTarget.style.background = tokens.blue600;
          }}
        >
          <Show when={hasAssignments()} fallback='Assign Randomly (Even Split)'>
            <FiCopy class='h-4 w-4' />
            Reshuffle
          </Show>
        </button>
      </div>

      {/* Preview section */}
      <Show when={hasAssignments()}>
        <section class='mt-6'>
          <div
            class='overflow-hidden rounded-xl border'
            style={{ 'border-color': hasConflicts() ? '#fca5a5' : tokens.blue200 }}
          >
            <div
              class='flex items-center justify-between border-b px-4 py-3'
              style={{
                'border-color': hasConflicts() ? '#fca5a5' : tokens.blue200,
                background: hasConflicts() ? '#fef2f2' : tokens.blue50,
              }}
            >
              <div>
                <h4 class='text-sm font-semibold' style={{ color: hasConflicts() ? '#991b1b' : tokens.blue900 }}>
                  Assignment Preview
                </h4>
                <Show when={hasConflicts()}>
                  <p class='text-xs' style={{ color: '#dc2626' }}>
                    {conflictCount()} conflict{conflictCount() !== 1 && 's'} - click Reshuffle
                  </p>
                </Show>
              </div>
              <span class='text-xs' style={{ color: tokens.slate500 }}>
                {studies.length} studies assigned
              </span>
            </div>

            <div class='max-h-64 overflow-y-auto'>
              <table class='w-full text-left'>
                <thead class='sticky top-0' style={{ background: tokens.slate50 }}>
                  <tr>
                    <th class='py-2 pl-4 pr-4 text-xs font-medium' style={{ color: tokens.slate500 }}>Study</th>
                    <th class='py-2 pr-4 text-xs font-medium' style={{ color: tokens.slate500 }}>1st Reviewer</th>
                    <th class='py-2 pr-4 text-xs font-medium' style={{ color: tokens.slate500 }}>2nd Reviewer</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={previewAssignments()}>
                    {(assignment, index) => <PreviewRow assignment={assignment} index={index()} />}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </Show>

      {/* Info callout */}
      <div class='mt-6 flex items-start gap-3 rounded-lg p-3' style={{ background: tokens.blue50 }}>
        <FiInfo class='mt-0.5 h-4 w-4 shrink-0' style={{ color: tokens.blue600 }} />
        <p class='text-sm' style={{ color: tokens.blue700 }}>
          You can reassign reviewers at any time from the Studies tab.
        </p>
      </div>

      {/* Navigation */}
      <div
        class='mt-10 flex items-center justify-between border-t pt-6'
        style={{ 'border-color': tokens.slate200 }}
      >
        <SecondaryButton onClick={props.onBack}>
          <FiChevronLeft class='h-4 w-4' />
          Back
        </SecondaryButton>

        <div class='flex items-center gap-3'>
          <SecondaryButton onClick={props.onSkip}>Skip for now</SecondaryButton>

          <PrimaryButton
            onClick={props.onFinish}
            disabled={hasAssignments() && hasConflicts()}
          >
            <Show when={hasAssignments()} fallback='Finish Setup'>
              Apply & Finish
            </Show>
            <FiCheck class='h-4 w-4' />
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN WIZARD COMPONENT
// ============================================================================

export default function ProjectWizardMock() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize step from URL or default to 1
  const getInitialStep = () => {
    const stepParam = parseInt(searchParams.step, 10);
    return stepParam >= 1 && stepParam <= 4 ? stepParam : 1;
  };

  const [currentStep, setCurrentStep] = createSignal(getInitialStep());

  // Sync step changes to URL
  const updateStep = (step) => {
    setCurrentStep(step);
    setSearchParams({ step: step.toString() });
  };

  return (
    <div
      class='min-h-screen'
      style={{
        background: `linear-gradient(180deg, ${tokens.slate50} 0%, white 100%)`,
        'font-family': "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Header */}
      <header
        class='sticky top-0 z-50 border-b'
        style={{
          background: 'rgba(255,255,255,0.8)',
          'backdrop-filter': 'blur(12px)',
          '-webkit-backdrop-filter': 'blur(12px)',
          'border-color': tokens.slate200,
        }}
      >
        <div class='mx-auto max-w-5xl px-6 py-4'>
          <div class='flex items-center justify-between'>
            <div class='flex items-center gap-3'>
              {/* Logo placeholder */}
              <div
                class='flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold'
                style={{ background: tokens.blue600, color: 'white' }}
              >
                C
              </div>
              <div>
                <h1
                  class='text-base font-semibold'
                  style={{ color: tokens.slate900 }}
                >
                  New Project
                </h1>
              </div>
            </div>

            <button
              class='flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors duration-200'
              style={{ color: tokens.slate500 }}
              onMouseEnter={e => {
                e.currentTarget.style.background = tokens.slate100;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <FiX class='h-4 w-4' />
              Exit
            </button>
          </div>
        </div>
      </header>

      {/* Stepper */}
      <div class='mx-auto max-w-5xl px-6 py-8'>
        <Stepper currentStep={currentStep()} />
      </div>

      {/* Content area */}
      <main class='mx-auto max-w-5xl px-6 pb-16'>
        <div
          class='rounded-2xl border p-8'
          style={{
            background: 'white',
            'border-color': tokens.slate200,
            'box-shadow': '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <Show when={currentStep() === 1}>
            <ProjectDetailsStep
              onNext={() => updateStep(2)}
              onCancel={() => {}}
            />
          </Show>

          <Show when={currentStep() === 2}>
            <TeamStep
              onBack={() => updateStep(1)}
              onNext={() => updateStep(3)}
              onSkip={() => updateStep(3)}
            />
          </Show>

          <Show when={currentStep() === 3}>
            <StudiesStep
              onBack={() => updateStep(2)}
              onNext={() => updateStep(4)}
              onSkip={() => updateStep(4)}
            />
          </Show>

          <Show when={currentStep() === 4}>
            <AssignmentStep
              onBack={() => updateStep(3)}
              onSkip={() => alert('Setup complete! Redirecting to project...')}
              onFinish={() => alert('Assignments applied! Redirecting to project...')}
            />
          </Show>
        </div>
      </main>

      {/* Load Inter font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      `}</style>
    </div>
  );
}
