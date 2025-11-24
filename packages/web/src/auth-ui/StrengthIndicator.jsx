import { createMemo, For } from 'solid-js';
import { createEffect } from 'solid-js';

const requirementsList = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8, error: 'at least 8 characters' },
  { label: 'Uppercase letter (A-Z)', test: (pw) => /[A-Z]/.test(pw), error: 'an uppercase letter' },
  { label: 'Lowercase letter (a-z)', test: (pw) => /[a-z]/.test(pw), error: 'a lowercase letter' },
  { label: 'Number (0-9)', test: (pw) => /\d/.test(pw), error: 'a number' },
  { label: 'Special character (e.g. !?<>@#$%)', test: (pw) => /[^A-Za-z0-9]/.test(pw), error: 'a special character' },
];

function getStrength(password) {
  password = password();
  if (!password) return { met: [], unmet: requirementsList.map((r) => r.label) };
  const met = requirementsList.filter((r) => r.test(password)).map((r) => r.label);
  const unmet = requirementsList.filter((r) => !r.test(password)).map((r) => r.label);
  const errors = requirementsList.filter((r) => !r.test(password)).map((r) => r.error);
  return { met, unmet, errors };
}

export default function StrengthIndicator(props) {
  const strength = createMemo(() => getStrength(() => props.password));

  createEffect(() => {
    props.onUnmet?.(strength().errors);
  });

  return (
    <div class="w-full mt-2">
      {/* Requirements */}
      <div class="text-xs text-gray-700" id="password-requirements" aria-live="polite">
        <ul class="pace-y-0.5 sm:space-y-1">
          <For each={requirementsList}>
            {(req) => {
              const met = () => strength().met.includes(req.label);
              return (
                <li class="flex items-center gap-2">
                  <span
                    class={`w-3.5 h-3.5 ml-1 rounded-full flex items-center justify-center ${
                      met() ?
                        'bg-white text-green-500 border-green-500 border-[1.5px]'
                      : 'border-red-500 border-[1.5px] text-red-500'
                    }`}
                    aria-hidden="true"
                  >
                    {met() ?
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 16 16">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 8l3 3 5-5" />
                      </svg>
                    : <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 16 16">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 5l6 6M11 5l-6 6" />
                      </svg>
                    }
                  </span>
                  <span class={met() ? 'text-green-500' : 'text-red-500'}>{req.label}</span>
                </li>
              );
            }}
          </For>
        </ul>
      </div>
    </div>
  );
}
