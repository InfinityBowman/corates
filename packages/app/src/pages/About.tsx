import { A } from '@solidjs/router';

function About() {
  return (
    <div class="min-h-screen bg-gray-100">
      <header class="bg-white shadow">
        <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 class="text-3xl font-bold text-gray-900">About</h1>
        </div>
      </header>
      <main>
        <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div class="px-4 py-6 sm:px-0">
            <div class="border-4 border-dashed border-gray-200 rounded-lg p-8">
              <h2 class="text-2xl font-semibold mb-4">About Corates</h2>
              <p class="mb-4 text-gray-600">
                Corates is a modern collaborative rating platform built with cutting-edge
                technologies:
              </p>
              <ul class="list-disc list-inside mb-6 space-y-2 text-gray-600">
                <li>
                  <strong>SolidJS</strong> - A declarative, efficient JavaScript UI library
                </li>
                <li>
                  <strong>Vite</strong> - Next-generation frontend tooling
                </li>
                <li>
                  <strong>Tailwind CSS</strong> - A utility-first CSS framework
                </li>
                <li>
                  <strong>D3.js</strong> - Data visualization library
                </li>
                <li>
                  <strong>Yjs</strong> - CRDT framework for real-time collaboration
                </li>
                <li>
                  <strong>Solid Router</strong> - Client-side routing for SolidJS
                </li>
                <li>
                  <strong>Cloudflare Workers</strong> - Serverless edge compute platform
                </li>
                <li>
                  <strong>Durable Objects</strong> - Strongly consistent coordination for Workers
                </li>
                <li>
                  <strong>Vitest</strong> - Fast unit test framework
                </li>
              </ul>
              <div>
                <A href="/" class="text-blue-500 hover:text-blue-700 underline">
                  Back to Home
                </A>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default About;
