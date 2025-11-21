import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('/*', cors());

app.get('/', c => {
  return c.json({ message: 'Corates API Worker' });
});

app.get('/health', c => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/rates', c => {
  return c.json({
    rates: [
      { id: 1, name: 'Item 1', rating: 4.5 },
      { id: 2, name: 'Item 2', rating: 3.8 },
      { id: 3, name: 'Item 3', rating: 4.9 },
    ],
  });
});

export default app;
