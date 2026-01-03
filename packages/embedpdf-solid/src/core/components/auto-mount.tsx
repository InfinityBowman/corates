import { type Component, type JSX } from 'solid-js';
import type { PluginBatchRegistrations } from '@embedpdf/core';

export interface AutoMountProps {
  plugins: PluginBatchRegistrations;
  children: JSX.Element;
}

/**
 * AutoMount component that automatically mounts DOM elements from plugins.
 * This is a placeholder - actual auto-mounting logic would need to be implemented
 * based on how EmbedPDF handles it.
 */
export const AutoMount: Component<AutoMountProps> = props => {
  return <>{props.children}</>;
};
