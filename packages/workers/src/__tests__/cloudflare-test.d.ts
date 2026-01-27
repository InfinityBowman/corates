/* eslint-disable no-unused-vars */
declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}

  export const env: ProvidedEnv;
  export function createExecutionContext(): ExecutionContext;
  export function waitOnExecutionContext(ctx: ExecutionContext): Promise<void>;
  export function runInDurableObject<T extends DurableObject>(
    stub: DurableObjectStub<T>,
    callback: (instance: T, state: DurableObjectState) => void | Promise<void>,
  ): Promise<void>;
}
