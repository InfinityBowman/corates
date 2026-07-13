declare module 'cloudflare:test' {
  export function createExecutionContext(): ExecutionContext;
  export function waitOnExecutionContext(ctx: ExecutionContext): Promise<void>;
  export function runInDurableObject<T extends DurableObject>(
    stub: DurableObjectStub<T>,
    callback: (instance: T, state: DurableObjectState) => void | Promise<void>,
  ): Promise<void>;
}
