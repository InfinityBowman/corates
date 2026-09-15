import { describe, it, expect, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, act } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TruncatedText } from '@/components/ui/truncated-text';

/** jsdom does no layout, so the widths truncation depends on are stubbed. */
function stubWidths(scrollWidth: number, clientWidth: number) {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get: () => scrollWidth,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => clientWidth,
  });
}

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
});

function renderText(text: string) {
  return render(
    <TooltipProvider>
      <TruncatedText text={text} />
    </TooltipProvider>,
  );
}

describe('TruncatedText', () => {
  it('leaves a name that fits without a tooltip', () => {
    stubWidths(100, 100);
    renderText('Trial A');

    expect(screen.getByText('Trial A')).not.toHaveAttribute('data-slot', 'tooltip-trigger');
  });

  it('offers the full name in a tooltip once it is clipped', async () => {
    stubWidths(900, 300);
    renderText('A long study name');

    // The measurement lands in an effect, so the tooltip is wired a pass later.
    await act(async () => {});

    expect(screen.getByText('A long study name')).toHaveAttribute('data-slot', 'tooltip-trigger');
  });
});
