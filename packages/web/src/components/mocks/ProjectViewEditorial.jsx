/**
 * ProjectView Mock - Editorial/Magazine Style
 *
 * Design Direction: Clean, typographic, newspaper-inspired with strong hierarchy.
 * Uses serif display fonts, generous whitespace, and editorial grid layouts.
 * Inspired by The New York Times, Bloomberg, and academic journals.
 */

import { For, Show, createSignal } from 'solid-js';
import { FiArrowLeft, FiPlus, FiFileText, FiUsers, FiCheck, FiClock, FiAlertCircle } from 'solid-icons/fi';

// Mock data
const mockProject = {
  name: 'Effectiveness of Mindfulness-Based Interventions for Chronic Pain Management',
  description: 'A systematic review examining RCTs of mindfulness interventions for chronic pain conditions including fibromyalgia, low back pain, and arthritis.',
  createdAt: '2024-12-15',
  members: [
    { id: '1', name: 'Dr. Sarah Chen', avatar: null, role: 'Lead' },
    { id: '2', name: 'Dr. Michael Torres', avatar: null, role: 'Reviewer' },
    { id: '3', name: 'Dr. Emily Watson', avatar: null, role: 'Reviewer' },
  ],
};

const mockStudies = [
  {
    id: '1',
    title: 'Mindfulness-Based Stress Reduction for Chronic Low Back Pain: A Randomized Controlled Trial',
    authors: 'Cherkin DC, Sherman KJ, Balderson BH, et al.',
    journal: 'JAMA',
    year: 2016,
    status: 'completed',
    reviewers: ['Dr. Sarah Chen', 'Dr. Michael Torres'],
    rating: 'High',
  },
  {
    id: '2',
    title: 'Effects of Mindfulness-Based Cognitive Therapy on Body Awareness in Patients with Chronic Pain',
    authors: 'de Jong M, Lazar SW, Hug K, et al.',
    journal: 'Frontiers in Psychology',
    year: 2016,
    status: 'reconcile',
    reviewers: ['Dr. Emily Watson', 'Dr. Sarah Chen'],
    rating: null,
  },
  {
    id: '3',
    title: 'A Pilot Study of Mindfulness Meditation for Pediatric Chronic Pain',
    authors: 'Jastrowski Mano KE, Salamon KS, Hainsworth KR, et al.',
    journal: 'Children',
    year: 2019,
    status: 'in-progress',
    reviewers: ['Dr. Michael Torres'],
    rating: null,
  },
  {
    id: '4',
    title: 'Mindfulness-Based Intervention for Fibromyalgia: Impact on Pain and Quality of Life',
    authors: 'Schmidt S, Grossman P, Schwarzer B, et al.',
    journal: 'Pain Medicine',
    year: 2020,
    status: 'pending',
    reviewers: [],
    rating: null,
  },
];

const stats = {
  total: 24,
  completed: 8,
  inProgress: 6,
  reconciling: 4,
  pending: 6,
};

function StatusBadge(props) {
  const colors = {
    'completed': 'bg-emerald-900 text-emerald-100',
    'reconcile': 'bg-amber-900 text-amber-100',
    'in-progress': 'bg-blue-900 text-blue-100',
    'pending': 'bg-stone-300 text-stone-700',
  };

  const labels = {
    'completed': 'Completed',
    'reconcile': 'Reconciling',
    'in-progress': 'In Progress',
    'pending': 'Pending',
  };

  return (
    <span class={`inline-block px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${colors[props.status]}`}>
      {labels[props.status]}
    </span>
  );
}

function RatingBadge(props) {
  const colors = {
    'High': 'border-emerald-700 text-emerald-700',
    'Moderate': 'border-amber-600 text-amber-600',
    'Low': 'border-rose-600 text-rose-600',
    'Critically Low': 'border-rose-900 text-rose-900',
  };

  return (
    <span class={`inline-block border px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${colors[props.rating]}`}>
      {props.rating}
    </span>
  );
}

export default function ProjectViewEditorial() {
  const [activeSection, setActiveSection] = createSignal('all');

  return (
    <div class="min-h-screen bg-stone-50">
      {/* Editorial Header */}
      <header class="border-b-2 border-stone-900 bg-white">
        <div class="mx-auto max-w-6xl px-8 py-6">
          {/* Breadcrumb */}
          <div class="mb-6 flex items-center gap-2 text-xs uppercase tracking-widest text-stone-500">
            <button class="flex items-center gap-1 hover:text-stone-900 transition-colors">
              <FiArrowLeft class="h-3 w-3" />
              Dashboard
            </button>
            <span>/</span>
            <span class="text-stone-900">Project</span>
          </div>

          {/* Title Block */}
          <div class="grid grid-cols-12 gap-8">
            <div class="col-span-8">
              <h1 class="font-serif text-4xl font-bold leading-tight text-stone-900 tracking-tight">
                {mockProject.name}
              </h1>
              <p class="mt-4 font-serif text-lg text-stone-600 leading-relaxed">
                {mockProject.description}
              </p>
            </div>

            {/* Meta sidebar */}
            <div class="col-span-4 border-l border-stone-200 pl-8">
              <div class="space-y-4">
                <div>
                  <h3 class="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-2">Research Team</h3>
                  <div class="space-y-1">
                    <For each={mockProject.members}>
                      {member => (
                        <div class="flex items-center gap-2">
                          <div class="h-6 w-6 rounded-full bg-stone-200 flex items-center justify-center text-[10px] font-medium text-stone-600">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span class="text-sm text-stone-700">{member.name}</span>
                          <Show when={member.role === 'Lead'}>
                            <span class="text-[9px] uppercase tracking-widest text-stone-400">(Lead)</span>
                          </Show>
                        </div>
                      )}
                    </For>
                  </div>
                </div>

                <div>
                  <h3 class="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-1">Created</h3>
                  <p class="text-sm text-stone-700">{mockProject.createdAt}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div class="border-b border-stone-200 bg-white">
        <div class="mx-auto max-w-6xl px-8 py-4">
          <div class="flex items-center gap-8">
            <div class="flex-1">
              <div class="flex h-2 overflow-hidden bg-stone-100">
                <div class="bg-emerald-600 transition-all" style={`width: ${(stats.completed / stats.total) * 100}%`} />
                <div class="bg-blue-500 transition-all" style={`width: ${(stats.inProgress / stats.total) * 100}%`} />
                <div class="bg-amber-500 transition-all" style={`width: ${(stats.reconciling / stats.total) * 100}%`} />
              </div>
            </div>
            <div class="flex items-center gap-6 text-xs">
              <div class="flex items-center gap-2">
                <div class="h-2 w-2 bg-emerald-600" />
                <span class="text-stone-600">{stats.completed} Completed</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="h-2 w-2 bg-blue-500" />
                <span class="text-stone-600">{stats.inProgress} In Progress</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="h-2 w-2 bg-amber-500" />
                <span class="text-stone-600">{stats.reconciling} Reconciling</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="h-2 w-2 bg-stone-200" />
                <span class="text-stone-600">{stats.pending} Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav class="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div class="mx-auto max-w-6xl px-8">
          <div class="flex gap-0">
            {[
              { id: 'all', label: 'All Studies', count: stats.total },
              { id: 'todo', label: 'My Tasks', count: 3 },
              { id: 'reconcile', label: 'Reconciliation', count: stats.reconciling },
              { id: 'completed', label: 'Completed', count: stats.completed },
            ].map(tab => (
              <button
                class={`relative px-6 py-4 text-sm font-medium transition-colors ${
                  activeSection() === tab.id
                    ? 'text-stone-900'
                    : 'text-stone-400 hover:text-stone-600'
                }`}
                onClick={() => setActiveSection(tab.id)}
              >
                {tab.label}
                <span class={`ml-2 text-xs ${activeSection() === tab.id ? 'text-stone-500' : 'text-stone-300'}`}>
                  {tab.count}
                </span>
                <Show when={activeSection() === tab.id}>
                  <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-900" />
                </Show>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main class="mx-auto max-w-6xl px-8 py-8">
        {/* Action Bar */}
        <div class="mb-8 flex items-center justify-between">
          <div class="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search studies..."
              class="w-64 border-b border-stone-300 bg-transparent px-0 py-2 text-sm placeholder-stone-400 focus:border-stone-900 focus:outline-none"
            />
          </div>
          <button class="flex items-center gap-2 bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 transition-colors">
            <FiPlus class="h-4 w-4" />
            Add Studies
          </button>
        </div>

        {/* Studies List */}
        <div class="space-y-0 divide-y divide-stone-200">
          <For each={mockStudies}>
            {(study, index) => (
              <article class="group py-6 first:pt-0">
                <div class="grid grid-cols-12 gap-6">
                  {/* Number */}
                  <div class="col-span-1">
                    <span class="font-serif text-3xl font-light text-stone-300">
                      {String(index() + 1).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Main Content */}
                  <div class="col-span-8">
                    <div class="flex items-start gap-3 mb-2">
                      <StatusBadge status={study.status} />
                      <Show when={study.rating}>
                        <RatingBadge rating={study.rating} />
                      </Show>
                    </div>

                    <h2 class="font-serif text-xl font-medium text-stone-900 leading-snug group-hover:text-stone-700 transition-colors cursor-pointer">
                      {study.title}
                    </h2>

                    <p class="mt-2 text-sm text-stone-500">
                      {study.authors}
                    </p>

                    <p class="mt-1 text-xs text-stone-400">
                      {study.journal}, {study.year}
                    </p>
                  </div>

                  {/* Reviewers */}
                  <div class="col-span-3">
                    <Show when={study.reviewers.length > 0}>
                      <h4 class="text-[10px] font-medium uppercase tracking-widest text-stone-400 mb-2">Reviewers</h4>
                      <div class="flex flex-wrap gap-1">
                        <For each={study.reviewers}>
                          {reviewer => (
                            <span class="inline-block bg-stone-100 px-2 py-1 text-xs text-stone-600">
                              {reviewer.split(' ').slice(-1)[0]}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                    <Show when={study.reviewers.length === 0}>
                      <button class="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors">
                        <FiUsers class="h-3 w-3" />
                        Assign reviewers
                      </button>
                    </Show>
                  </div>
                </div>
              </article>
            )}
          </For>
        </div>

        {/* Load More */}
        <div class="mt-8 text-center">
          <button class="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors">
            Load more studies
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer class="border-t border-stone-200 bg-white mt-16">
        <div class="mx-auto max-w-6xl px-8 py-6">
          <p class="text-xs text-stone-400 uppercase tracking-widest">
            CoRATES / Collaborative Research Appraisal Tool for Evidence Synthesis
          </p>
        </div>
      </footer>

      {/* Embedded Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;700&family=Inter:wght@400;500;600&display=swap');

        .font-serif {
          font-family: 'Playfair Display', Georgia, serif;
        }
      `}</style>
    </div>
  );
}
