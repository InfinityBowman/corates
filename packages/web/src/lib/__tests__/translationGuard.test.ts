import { describe, it, expect, beforeAll, vi } from 'vitest';
import { installTranslationGuard } from '../translationGuard';
import { clientLogger } from '../clientLogger';

const warn = vi.spyOn(clientLogger, 'warn').mockImplementation(() => {});

// Mimics Chrome translate replacing a text node with a <font> wrapper
function translate(parent: HTMLElement, text: Text) {
  const font = document.createElement('font');
  font.textContent = text.textContent;
  parent.replaceChild(font, text);
  return font;
}

describe('installTranslationGuard', () => {
  beforeAll(() => {
    installTranslationGuard();
  });

  it('ignores removeChild for a text node translation already replaced', () => {
    const span = document.createElement('span');
    const text = document.createTextNode('Select a title');
    span.appendChild(text);
    const font = translate(span, text);

    expect(span.removeChild(text)).toBe(text);
    expect(span.firstChild).toBe(font);
    expect(warn).toHaveBeenCalledWith(
      'client.translation_guard',
      expect.objectContaining({ operation: 'removeChild' }),
    );
  });

  it('ignores insertBefore when the reference node was replaced', () => {
    const span = document.createElement('span');
    const text = document.createTextNode('Dr.');
    span.appendChild(text);
    translate(span, text);

    const incoming = document.createTextNode('Prof.');
    expect(span.insertBefore(incoming, text)).toBe(incoming);
    expect(incoming.parentNode).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('still removes and inserts real children', () => {
    const span = document.createElement('span');
    const a = document.createTextNode('a');
    const b = document.createTextNode('b');
    span.appendChild(a);

    span.insertBefore(b, a);
    expect(span.firstChild).toBe(b);

    span.removeChild(a);
    expect(span.childNodes.length).toBe(1);
    expect(span.firstChild).toBe(b);
  });
});
