import * as passwordInput from '@zag-js/password-input';
import { useMachine, normalizeProps } from '@zag-js/solid';
import { createMemo, createUniqueId, Show } from 'solid-js';
import { FiEyeOff, FiEye } from 'solid-icons/fi';

export default function PasswordInput(props) {
  const autoComplete = () => props.autoComplete;
  const password = () => props.password;
  const required = () => props.required;
  const inputClass = () => props.inputClass;
  const iconSize = () => props.iconSize;
  const classValue = () => props.class;
  const label = () => props.label;

  const service = useMachine(passwordInput.machine, {
    id: createUniqueId(),
    autoComplete: () => autoComplete() || 'new-password',
    value: () => password() || '',
    required: () => required() || false,
  });

  const api = createMemo(() => passwordInput.connect(service, normalizeProps));
  const computedInputClass = () =>
    inputClass() ||
    'w-full pl-3 sm:pl-4 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition big-placeholder';
  const computedIconSize = () => iconSize() || 20;

  return (
    <div {...api().getRootProps()} class={classValue()}>
      <label
        {...api().getLabelProps()}
        class='block text-xs sm:text-sm font-semibold text-gray-700 mb-1 sm:mb-2'
      >
        {label() || 'Password'}
      </label>
      <div {...api().getControlProps()} class='relative'>
        <input
          {...api().getInputProps()}
          class={computedInputClass()}
          onInput={e => props.onPasswordChange?.(e.target.value)}
          placeholder='••••••••'
        />
        <button
          {...api().getVisibilityTriggerProps()}
          class='absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400'
        >
          <span {...api().getIndicatorProps()}>
            <Show
              when={api().visible}
              fallback={<FiEyeOff size={computedIconSize() - 2} />}
            >
              <FiEye size={computedIconSize()} />
            </Show>
          </span>
        </button>
      </div>
    </div>
  );
}
