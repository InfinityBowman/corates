/**
 * ToolbarButton - Reusable toolbar button component for Preact
 */

export default function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  children,
  'aria-label': ariaLabel,
  title,
  class: className = '',
}) {
  const baseClasses =
    isActive ?
      'bg-blue-50 text-blue-600 ring-1 ring-blue-500'
    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900';

  const disabledClasses =
    disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-gray-600' : '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      class={`rounded p-1.5 transition-colors ${baseClasses} ${disabledClasses} ${className}`}
      aria-label={ariaLabel}
      aria-pressed={isActive}
      aria-disabled={disabled}
      title={title || ariaLabel}
    >
      {children}
    </button>
  );
}
