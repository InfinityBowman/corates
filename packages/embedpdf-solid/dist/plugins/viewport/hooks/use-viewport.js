import { useCapability, usePlugin } from '../../../core';
import { ViewportPlugin } from '@embedpdf/plugin-viewport';
export const useViewportPlugin = () => usePlugin(ViewportPlugin.id);
export const useViewportCapability = () => useCapability(ViewportPlugin.id);
//# sourceMappingURL=use-viewport.js.map