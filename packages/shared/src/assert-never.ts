/**
 * Exhaustiveness guard for discriminated unions.
 *
 * Pass the variable being narrowed in the unreachable branch of a switch or
 * if-chain. If a new variant is added to the union without handling it here,
 * the call site stops type-checking — turning a runtime UI bug into a build
 * error.
 *
 * @example
 *   switch (item.type) {
 *     case 'a': return renderA(item);
 *     case 'b': return renderB(item);
 *     default: return assertNever(item);
 *   }
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminated union variant: ${JSON.stringify(value)}`);
}
