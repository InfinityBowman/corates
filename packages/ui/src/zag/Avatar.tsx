/**
 * Avatar component using Ark UI
 */

import { Avatar } from '@ark-ui/solid/avatar';
import { Component } from 'solid-js';

export interface AvatarProps {
  /** Image source URL */
  src?: string;
  /** Name for generating initials fallback */
  name?: string;
  /** Alt text for image */
  alt?: string;
  /** Callback when image loading status changes */
  onStatusChange?: (details: { status: 'loading' | 'loaded' | 'error' }) => void;
  /** CSS classes for fallback element */
  fallbackClass?: string;
  /** Additional class for root element */
  class?: string;
}

/**
 * Avatar - User avatar with fallback support
 */
const AvatarComponent: Component<AvatarProps> = (props) => {
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
    <Avatar.Root onStatusChange={onStatusChange()} class={`overflow-hidden ${props.class || ''}`}>
      <Avatar.Fallback class={fallbackClass()}>{getInitials()}</Avatar.Fallback>
      <Avatar.Image
        alt={alt()}
        src={src()}
        referrerPolicy='no-referrer'
        class='h-full w-full object-cover'
      />
    </Avatar.Root>
  );
};

export { AvatarComponent as Avatar };
