import { createMemo, For, createEffect } from 'solid-js';
import { FiCheck, FiX } from 'solid-icons/fi';

const requirementsList = [
  {
    label: 'At least 8 characters',
    test: pw => pw.length >= 8,
    error: 'at least 8 characters',
  },
  {
    label: 'Uppercase letter (A-Z)',
    test: pw => /[A-Z]/.test(pw),
    error: 'an uppercase letter',
  },
  {
    label: 'Lowercase letter (a-z)',
    test: pw => /[a-z]/.test(pw),
    error: 'a lowercase letter',
  },
  { label: 'Number (0-9)', test: pw => /\d/.test(pw), error: 'a number' },
  {
    label: 'Special character (e.g. !?<>@#$%)',
    test: pw => /[^A-Za-z0-9]/.test(pw),
    error: 'a special character',
  },
];

function getStrength(password) {
  if (!password) return { met: [], unmet: requirementsList.map(r => r.label) };
  const met = requirementsList.filter(r => r.test(password)).map(r => r.label);
  const unmet = requirementsList.filter(r => !r.test(password)).map(r => r.label);
  const errors = requirementsList.filter(r => !r.test(password)).map(r => r.error);
  return { met, unmet, errors };
}

export default function StrengthIndicator(props) {
  const strength = createMemo(() => getStrength(props.password));

  createEffect(() => {
    props.onUnmet?.(strength().errors);
  });

  return (
    <div class='mt-2 w-full'>
      {/* Requirements */}
      <div class='text-secondary-foreground text-xs' id='password-requirements' aria-live='polite'>
        <ul class='pace-y-0.5 sm:space-y-1'>
          <For each={requirementsList}>
            {req => {
              const met = () => strength().met.includes(req.label);
              return (
                <li class='flex items-center gap-2'>
                  <span
                    class={`ml-1 flex h-4 w-4 items-center justify-center rounded-full ${
                      met() ?
                        'border border-green-500 bg-white text-green-500'
                      : 'border border-red-600 text-red-600'
                    }`}
                    aria-hidden='true'
                  >
                    {met() ?
                      <FiCheck class='h-3 w-3' />
                    : <FiX class='h-3 w-3' />}
                  </span>
                  <span class={met() ? 'text-green-500' : 'text-red-600'}>{req.label}</span>
                </li>
              );
            }}
          </For>
        </ul>
      </div>
    </div>
  );
}
