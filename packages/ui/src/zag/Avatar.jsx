/**
 * Avatar component using Ark UI
 */

import { Avatar } from '@ark-ui/solid/avatar';

/**
 * Avatar - User avatar with fallback support
 *
 * Props:
 * - src: string - Image source URL
 * - name: string - Name for generating initials fallback
 * - alt: string - Alt text for image
 * - onStatusChange: (details: StatusChangeDetails) => void - Callback when image loading status changes
 * - fallbackClass: string - CSS classes for fallback element
 * - class: string - Additional class for root element
 */
export function AvatarComponent(props) {
  const src = () => props.src;
  const name = () => props.name;
  const alt = () => props.alt || name() || 'Avatar';
  const onStatusChange = () => props.onStatusChange;

  const getInitials = () => {
    const displayName = name();
    if (!displayName) return '';
    const parts = displayName.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const fallbackClass = () =>
    props.fallbackClass ||
    'flex items-center justify-center w-full h-full bg-gray-200 text-gray-700 font-medium';

  return (
    <Avatar.Root
      onStatusChange={onStatusChange()}
      class={`overflow-hidden ${props.class || ''}`}
    >
      <Avatar.Fallback class={fallbackClass()}>{getInitials()}</Avatar.Fallback>
      <Avatar.Image
        alt={alt()}
        src={src()}
        referrerPolicy='no-referrer'
        class='h-full w-full object-cover'
      />
    </Avatar.Root>
  );
}

export { AvatarComponent as Avatar };
export default AvatarComponent;
