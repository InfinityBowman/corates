export class Counter {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/increment') {
      const currentValue = (await this.state.storage.get('value')) || 0;
      const newValue = currentValue + 1;
      await this.state.storage.put('value', newValue);
      return new Response(JSON.stringify({ value: newValue }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/value') {
      const currentValue = (await this.state.storage.get('value')) || 0;
      return new Response(JSON.stringify({ value: currentValue }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }
}

export default {
  async fetch(request, env) {
    const id = env.COUNTER.idFromName('global-counter');
    const obj = env.COUNTER.get(id);
    return obj.fetch(request);
  },
};
