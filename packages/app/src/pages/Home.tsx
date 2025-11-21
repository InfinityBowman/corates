import { A } from '@solidjs/router';
import { createSignal, onMount } from 'solid-js';
import * as Y from 'yjs';
import Chart from '../components/Chart';

function Home() {
  const [count, setCount] = createSignal(0);
  const [ydoc] = createSignal(new Y.Doc());

  onMount(() => {
    const ymap = ydoc().getMap('data');
    ymap.set('count', 0);

    ymap.observe(() => {
      const newCount = ymap.get('count') as number;
      setCount(newCount);
    });
  });

  const increment = () => {
    const ymap = ydoc().getMap('data');
    const current = (ymap.get('count') as number) || 0;
    ymap.set('count', current + 1);
  };

  return (
    <div class="min-h-screen bg-gray-100">
      <header class="bg-white shadow">
        <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 class="text-3xl font-bold text-gray-900">Corates</h1>
        </div>
      </header>
      <main>
        <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div class="px-4 py-6 sm:px-0">
            <div class="border-4 border-dashed border-gray-200 rounded-lg p-8">
              <h2 class="text-2xl font-semibold mb-4">
                Welcome to Corates - A Collaborative Rating Platform
              </h2>
              <p class="mb-4 text-gray-600">
                Built with SolidJS, Vite, Tailwind CSS, D3, Yjs, and Cloudflare Workers
              </p>
              <div class="mb-6">
                <button
                  onClick={increment}
                  class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Count (Yjs): {count()}
                </button>
              </div>
              <div class="mb-6">
                <Chart />
              </div>
              <div>
                <A href="/about" class="text-blue-500 hover:text-blue-700 underline">
                  About
                </A>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Home;
