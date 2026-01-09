/**
 * AdminBox - Consistent container component for admin UI
 *
 * A styled container following Polar's ShadowBox pattern with
 * configurable padding and clean visual hierarchy.
 *
 * @example
 * <AdminBox>Basic content</AdminBox>
 * <AdminBox padding="compact">Compact padding</AdminBox>
 * <AdminBox padding="spacious" class="mt-4">Extra padding with margin</AdminBox>
 */

/**
 * @param {Object} props
 * @param {'compact'|'default'|'spacious'} [props.padding='default'] - Padding size
 * @param {string} [props.class] - Additional CSS classes
 * @param {JSX.Element} props.children - Box content
 */
export function AdminBox(props) {
  const paddingClasses = {
    compact: 'p-4',
    default: 'p-6',
    spacious: 'p-8',
  };

  return (
    <div
      class={`rounded-xl border border-gray-200 bg-white shadow-xs ${paddingClasses[props.padding || 'default']} ${props.class || ''}`}
    >
      {props.children}
    </div>
  );
}

export default AdminBox;
