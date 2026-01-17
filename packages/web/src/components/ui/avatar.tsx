/**
 * Avatar component for user profile images with fallback.
 *
 * @example
 * <Avatar>
 *   <AvatarImage src="/user.jpg" alt="John Doe" />
 *   <AvatarFallback>JD</AvatarFallback>
 * </Avatar>
 *
 * @example
 * // Custom size
 * <Avatar class="h-16 w-16">
 *   <AvatarImage src="/user.jpg" />
 *   <AvatarFallback>JD</AvatarFallback>
 * </Avatar>
 *
 * @example
 * // Fallback only (no image)
 * <Avatar>
 *   <AvatarFallback>AB</AvatarFallback>
 * </Avatar>
 */
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Avatar as AvatarPrimitive } from '@ark-ui/solid/avatar';
import type {
  AvatarRootProps as ArkAvatarRootProps,
  AvatarImageProps as ArkAvatarImageProps,
  AvatarFallbackProps as ArkAvatarFallbackProps,
} from '@ark-ui/solid/avatar';
import { cn } from './cn';

type AvatarProps = ArkAvatarRootProps & {
  class?: string;
  children?: JSX.Element;
};

const Avatar: Component<AvatarProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <AvatarPrimitive.Root
      class={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', local.class)}
      {...others}
    >
      {local.children}
    </AvatarPrimitive.Root>
  );
};

type AvatarImageProps = ArkAvatarImageProps & {
  class?: string;
};

const AvatarImage: Component<AvatarImageProps> = props => {
  const [local, others] = splitProps(props, ['class']);
  return (
    <AvatarPrimitive.Image
      class={cn('aspect-square h-full w-full object-cover', local.class)}
      {...others}
    />
  );
};

type AvatarFallbackProps = ArkAvatarFallbackProps & {
  class?: string;
  children?: JSX.Element;
};

const AvatarFallback: Component<AvatarFallbackProps> = props => {
  const [local, others] = splitProps(props, ['class', 'children']);
  return (
    <AvatarPrimitive.Fallback
      class={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600',
        local.class,
      )}
      {...others}
    >
      {local.children}
    </AvatarPrimitive.Fallback>
  );
};

export { Avatar, AvatarImage, AvatarFallback };
