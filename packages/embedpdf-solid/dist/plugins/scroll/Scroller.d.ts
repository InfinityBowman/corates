import { type Component, type JSX } from 'solid-js';
import type { PageLayout } from '@embedpdf/plugin-scroll';
export interface ScrollerProps {
    documentId: string;
    renderPage: (_layout: PageLayout) => JSX.Element;
    class?: string;
    style?: string | JSX.CSSProperties;
}
export declare const Scroller: Component<ScrollerProps>;
//# sourceMappingURL=Scroller.d.ts.map