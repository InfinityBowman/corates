declare module 'cloudflare:test' {
  export function createExecutionContext(): ExecutionContext;
  export function waitOnExecutionContext(ctx: ExecutionContext): Promise<void>;
  export function runInDurableObject<T extends DurableObject, R>(
    stub: DurableObjectStub<T>,
    callback: (instance: T, state: DurableObjectState) => R | Promise<R>,
  ): Promise<R>;
  export function evictDurableObject(
    stub: DurableObjectStub,
    options?: { webSockets?: 'close' | 'hibernate' },
  ): Promise<void>;
  export function evictAllDurableObjects(options?: {
    webSockets?: 'close' | 'hibernate';
  }): Promise<void>;
  export function abortAllDurableObjects(): Promise<void>;
  export function listDurableObjectIds(
    namespace: DurableObjectNamespace,
  ): Promise<Array<{ toString(): string; equals(other: unknown): boolean }>>;
}
