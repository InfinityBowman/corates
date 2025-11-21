export interface Env {
  COUNTER: DurableObjectNamespace;
}

export class Counter {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/increment': {
        const currentValue = (await this.state.storage.get<number>('value')) || 0;
        const newValue = currentValue + 1;
        await this.state.storage.put('value', newValue);
        return new Response(JSON.stringify({ value: newValue }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case '/decrement': {
        const currentValue = (await this.state.storage.get<number>('value')) || 0;
        const newValue = currentValue - 1;
        await this.state.storage.put('value', newValue);
        return new Response(JSON.stringify({ value: newValue }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case '/value': {
        const currentValue = (await this.state.storage.get<number>('value')) || 0;
        return new Response(JSON.stringify({ value: currentValue }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response('Not found', { status: 404 });
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.COUNTER.idFromName('global-counter');
    const obj = env.COUNTER.get(id);
    return obj.fetch(request);
  },
};
