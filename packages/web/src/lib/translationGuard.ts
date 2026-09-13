import { clientLogger } from '@/lib/clientLogger';

// Browser page translation (Chrome, and extensions like it) swaps bare text
// nodes for <font> wrappers behind React's back. React then throws
// NotFoundError from removeChild or insertBefore when it reconciles that text,
// and the error boundary takes the whole page down. Skipping the operation
// when the node is no longer where React left it turns that crash into, at
// worst, a stale piece of translated text that the next render clears.
// See https://github.com/facebook/react/issues/11538.
export function installTranslationGuard() {
  if (typeof Node === 'undefined') return;

  const { removeChild, insertBefore } = Node.prototype;

  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      logOnce('removeChild');
      return child;
    }
    return removeChild.call(this, child) as T;
  };

  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    node: T,
    reference: Node | null,
  ): T {
    if (reference && reference.parentNode !== this) {
      logOnce('insertBefore');
      return node;
    }
    return insertBefore.call(this, node, reference) as T;
  };
}

// A translated page trips the guard on every reconciled text node, so one
// line per page load is enough to see how often this happens and to whom.
let logged = false;

function logOnce(operation: 'removeChild' | 'insertBefore') {
  if (logged) return;
  logged = true;
  const html = document.documentElement;
  clientLogger.warn('client.translation_guard', {
    operation,
    translated: /\btranslated-(ltr|rtl)\b/.test(html.className),
    lang: html.lang,
  });
}
