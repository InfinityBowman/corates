/**
 * Bug-hunt probes for shared html.ts (sanitizeEmailSubject)
 *
 * Reachability: packages/workers/src/lib/send-invitation-email.ts:83 passes the
 * user-supplied project name (up to 255 chars, org-projects.functions.ts:34)
 * through sanitizeEmailSubject before interpolating it into the invitation
 * email subject line.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeEmailSubject } from '../html.js';

describe('sanitizeEmailSubject', () => {
  // .fails: documents a known unfixed bug without failing CI. When the bug is
  // fixed, vitest reports this test as failing -- then restore plain it().
  it.fails('turns interior whitespace (tabs/newlines) into spaces instead of deleting it', () => {
    // Doc comment promises "Collapses multiple whitespace into single spaces",
    // but control characters (\t, \r, \n) are deleted BEFORE the whitespace
    // collapse, so words separated only by a tab or newline get concatenated.
    // A tab pasted into the project name input survives to the server
    // (input value sanitization strips line breaks, not tabs).
    expect(sanitizeEmailSubject('Hello\tWorld')).toBe('Hello World');
    expect(sanitizeEmailSubject('Hello\r\nWorld')).toBe('Hello World');
  });

  it.fails('does not split a surrogate pair at the truncation boundary', () => {
    // An emoji straddling index 78 must not be cut in half, which would leave
    // a lone surrogate (mojibake) in the subject line.
    const name = 'a'.repeat(77) + '\u{1F600}' + ' extra text';
    const result = sanitizeEmailSubject(name);
    // Must not end with an unpaired high surrogate
    expect(/[\uD800-\uDBFF]$/.test(result)).toBe(false);
  });
});
