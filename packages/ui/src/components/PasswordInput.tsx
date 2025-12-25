/**
 * PasswordInput component using Ark UI
 */

import { PasswordInput } from '@ark-ui/solid/password-input';
import { Component, createSignal } from 'solid-js';
import { FiEyeOff, FiEye } from 'solid-icons/fi';

export interface PasswordInputProps {
  /** Controlled password value */
  password?: string;
  /** Callback when password changes */
  onPasswordChange?: (value: string) => void;
  /** Autocomplete attribute (default: 'new-password') */
  autoComplete?: 'current-password' | 'new-password';
  /** Whether input is required */
  required?: boolean;
  /** Additional class for input element */
  inputClass?: string;
  /** Size of visibility icon (default: 20) */
  iconSize?: number;
  /** Additional class for root element */
  class?: string;
  /** Input label (default: 'Password') */
  label?: string;
}

/**
 * PasswordInput - Password input with visibility toggle
 */
const PasswordInputComponent: Component<PasswordInputProps> = props => {
  const autoComplete = () => props.autoComplete || 'new-password';
  const password = () => props.password || '';
  const required = () => props.required || false;
  const inputClass = () => props.inputClass;
  const iconSize = () => props.iconSize || 20;
  const classValue = () => props.class;
  const label = () => props.label || 'Password';

  const [visible, setVisible] = createSignal(false);

  const computedInputClass = () =>
    inputClass() ||
    'w-full pl-3 sm:pl-4 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 transition big-placeholder';

  const handleInput = (e: Event & { target: HTMLInputElement }) => {
    props.onPasswordChange?.(e.target.value);
  };

  return (
    <PasswordInput.Root
      visible={visible()}
      onVisibilityChange={(details: { visible: boolean }) => setVisible(details.visible)}
      autoComplete={autoComplete()}
      required={required()}
      class={classValue()}
    >
      <PasswordInput.Label class='mb-1 block text-xs font-semibold text-gray-700 sm:mb-2 sm:text-sm'>
        {label()}
      </PasswordInput.Label>
      <PasswordInput.Control class='relative'>
        <PasswordInput.Input
          value={password()}
          onInput={handleInput}
          placeholder='••••••••'
          class={computedInputClass()}
        />
        <PasswordInput.VisibilityTrigger class='absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 sm:right-4'>
          <PasswordInput.Indicator fallback={<FiEyeOff size={iconSize() - 2} />}>
            <FiEye size={iconSize()} />
          </PasswordInput.Indicator>
        </PasswordInput.VisibilityTrigger>
      </PasswordInput.Control>
    </PasswordInput.Root>
  );
};

export { PasswordInputComponent as PasswordInput };
export default PasswordInputComponent;
