import * as avatar from '@zag-js/avatar';
import { normalizeProps, useMachine } from '@zag-js/solid';
import { createMemo, createUniqueId } from 'solid-js';

export function Avatar(props) {
  const src = () => props.src;
  const name = () => props.name;
  const alt = () => props.alt || name() || 'Avatar';
  const onStatusChange = () => props.onStatusChange;

  const service = useMachine(avatar.machine, () => ({
    id: createUniqueId(),
    onStatusChange: onStatusChange(),
  }));

  const api = createMemo(() => avatar.connect(service, normalizeProps));

  const getInitials = () => {
    const displayName = name();
    if (!displayName) return '';
    const parts = displayName.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div {...api().getRootProps()} class={props.class}>
      <span
        {...api().getFallbackProps()}
        class='flex items-center justify-center w-full h-full bg-gray-200 text-gray-700 font-medium'
      >
        {getInitials()}
      </span>
      <img alt={alt()} src={src()} {...api().getImageProps()} class='w-full h-full object-cover' />
    </div>
  );
}

export default Avatar;
