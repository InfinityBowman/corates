export interface Env {
  COUNTER: DurableObjectNamespace;
}

export class Counter {
  private state: DurableObjectState;
  private value: number = 0;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/increment':
        this.value = (await this.state.storage.get<number>('value')) || 0;
        this.value++;
        await this.state.storage.put('value', this.value);
        return new Response(JSON.stringify({ value: this.value }), {
          headers: { 'Content-Type': 'application/json' },
        });

      case '/decrement':
        this.value = (await this.state.storage.get<number>('value')) || 0;
        this.value--;
        await this.state.storage.put('value', this.value);
        return new Response(JSON.stringify({ value: this.value }), {
          headers: { 'Content-Type': 'application/json' },
        });

      case '/value':
        this.value = (await this.state.storage.get<number>('value')) || 0;
        return new Response(JSON.stringify({ value: this.value }), {
          headers: { 'Content-Type': 'application/json' },
        });

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
