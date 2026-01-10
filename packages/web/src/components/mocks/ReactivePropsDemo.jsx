/**
 * Demonstrates SolidJS reactive store access pattern.
 *
 * Key patterns:
 * - Import stores directly (no prop drilling)
 * - Access store data via getter functions
 * - Use createMemo for derived/computed values
 * - Props are only for local config (projectId), not shared state
 */

import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { createStore, produce } from 'solid-js/store';

// ============================================
// Fake store (normally in @/stores/someStore.js)
// ============================================
const [store, setStore] = createStore({
  projects: {
    'proj-1': { title: 'Project Alpha', connected: true },
    'proj-2': { title: 'Project Beta', connected: true },
  },
  studies: {
    'proj-1': [
      { id: '1', title: 'Study A', status: 'completed' },
      { id: '2', title: 'Study B', status: 'in-progress' },
    ],
    'proj-2': [{ id: '3', title: 'Study X', status: 'not-started' }],
  },
  counter: 0,
});

/**
 * Get a project by ID
 * @param {string} projectId
 */
function getProject(projectId) {
  return store.projects[projectId] || null;
}

/**
 * Get studies for a project
 * @param {string} projectId
 */
function getStudies(projectId) {
  return store.studies[projectId] ?? [];
}

/**
 * Get connection state for a project
 * @param {string} projectId
 */
function getConnectionState(projectId) {
  return { connected: store.projects[projectId]?.connected ?? false };
}

/**
 * Get counter value
 */
function getCounter() {
  return store.counter;
}

// Actions
function incrementCounter() {
  setStore('counter', c => c + 1);
}

function addStudy(projectId, study) {
  setStore(
    produce(s => {
      s.studies[projectId].push(study);
    }),
  );
}

const fakeStore = {
  getProject,
  getStudies,
  getConnectionState,
  getCounter,
  incrementCounter,
  addStudy,
};

// ============================================
// Demo wrapper with controls
// ============================================
export default function ReactivePropsDemo() {
  const [projectId, setProjectId] = createSignal('proj-1');
  let intervalId;

  onMount(() => {
    // Auto-increment counter every second to show reactivity
    intervalId = setInterval(() => fakeStore.incrementCounter(), 1000);
  });

  onCleanup(() => clearInterval(intervalId));

  const handleAddStudy = () => {
    const id = crypto.randomUUID();
    fakeStore.addStudy(projectId(), {
      id,
      title: `Study ${fakeStore.getStudies(projectId()).length + 1}`,
      status: 'not-started',
    });
  };

  return (
    <div class='space-y-4 p-4'>
      <h1 class='text-lg font-bold'>Reactive Store Demo</h1>
      <p class='text-sm text-gray-600'>
        Counter auto-increments. Switch projects to see prop reactivity.
      </p>

      <div class='flex gap-2'>
        <button
          class='rounded px-3 py-1'
          classList={{
            'bg-blue-500 text-white': projectId() === 'proj-1',
            'bg-gray-200': projectId() !== 'proj-1',
          }}
          onClick={() => setProjectId('proj-1')}
        >
          Project Alpha
        </button>
        <button
          class='rounded px-3 py-1'
          classList={{
            'bg-blue-500 text-white': projectId() === 'proj-2',
            'bg-gray-200': projectId() !== 'proj-2',
          }}
          onClick={() => setProjectId('proj-2')}
        >
          Project Beta
        </button>
        <button class='rounded bg-green-500 px-3 py-1 text-white' onClick={handleAddStudy}>
          Add Study
        </button>
      </div>

      <ProjectView projectId={projectId()} />
    </div>
  );
}

// ============================================
// Component that reads from store (the pattern)
// ============================================
function ProjectView(props) {
  // Read store data via getter functions - reactive
  const project = () => fakeStore.getProject(props.projectId);
  const studies = () => fakeStore.getStudies(props.projectId);
  const connected = () => fakeStore.getConnectionState(props.projectId).connected;
  const counter = () => fakeStore.getCounter();

  // Derived values with createMemo (cached, recomputes when dependencies change)
  const stats = createMemo(() => {
    const studyList = studies();
    const total = studyList.length;
    const completed = studyList.filter(s => s.status === 'completed').length;
    return { total, completed };
  });

  // Simple derived value as getter (no caching needed)
  const hasStudies = () => stats().total > 0;

  return (
    <div class='rounded border p-4'>
      <p class='text-sm text-gray-500'>Counter: {counter()}</p>

      <Show when={connected()} fallback={<p>Connecting...</p>}>
        <h2 class='font-semibold'>{project()?.title ?? 'Untitled'}</h2>
        <p>
          Studies: {stats().completed}/{stats().total}
        </p>

        <Show when={hasStudies()} fallback={<p>No studies yet</p>}>
          <ul class='list-disc pl-4'>
            <For each={studies()}>{study => <li>{study.title}</li>}</For>
          </ul>
        </Show>
      </Show>
    </div>
  );
}
