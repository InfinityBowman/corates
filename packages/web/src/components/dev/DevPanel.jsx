/**
 * DevPanel - Floating development panel for Yjs state inspection
 *
 * Only rendered when DEV mode is enabled (VITE_DEV_PANEL=true).
 * Context-aware: shows different tools based on current route.
 * - Dashboard: Import Project from JSON
 * - Project view: State tree, templates, JSON export/import
 */

import { createSignal, Show, createEffect, onCleanup, createMemo } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Portal } from 'solid-js/web';
import { useParams, useNavigate } from '@solidjs/router';
import { FiX, FiChevronDown, FiChevronUp, FiLayout } from 'solid-icons/fi';
import { VsJson, VsDebug } from 'solid-icons/vs';
import projectStore from '@/stores/projectStore.js';
import DevStateTree from './DevStateTree.jsx';
import DevTemplateSelector from './DevTemplateSelector.jsx';
import DevQuickActions from './DevQuickActions.jsx';
import DevJsonEditor from './DevJsonEditor.jsx';
import DevImportProject from './DevImportProject.jsx';
import DevToastTester from './DevToastTester.jsx';

export default function DevPanel() {
  const params = useParams();
  const navigate = useNavigate();

  // Detect if we're in a project context - use createMemo for derived state
  const projectId = createMemo(() => params.projectId);
  const isProjectContext = createMemo(() => !!projectId());

  // Get orgId reactively - createMemo ensures this updates when projectId changes
  const orgId = createMemo(() => {
    const pid = projectId();
    if (!pid) return null;

    // Try to get from project meta (Y.js synced data)
    const project = projectStore.getProject(pid);
    if (project?.meta?.orgId) {
      return project.meta.orgId;
    }
    return null;
  });

  const [isOpen, setIsOpen] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal(null);
  const [isMinimized, setIsMinimized] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);
  const [isResizing, setIsResizing] = createSignal(false);

  // Panel geometry state (using store for fine-grained reactivity)
  const [panel, setPanel] = createStore({
    position: { x: 20, y: 20 },
    size: { width: 420, height: 500 },
    dragOffset: { x: 0, y: 0 },
  });

  // Set default tab based on context
  createEffect(() => {
    if (activeTab() === null) {
      setActiveTab(isProjectContext() ? 'tree' : 'import');
    }
  });

  // Reset tab when context changes
  createEffect(() => {
    const inProject = isProjectContext();
    const currentTab = activeTab();
    // If we moved out of project context and on a project-only tab, switch to import
    if (
      !inProject &&
      (currentTab === 'tree' || currentTab === 'templates' || currentTab === 'json')
    ) {
      setActiveTab('import');
    }
    // If we moved into project context and on import tab, switch to tree
    if (inProject && currentTab === 'import') {
      setActiveTab('tree');
    }
  });

  // Get project data from store (only when in project context)
  const projectData = () => (projectId() ? projectStore.getProject(projectId()) : null);
  const connectionState = () => (projectId() ? projectStore.getConnectionState(projectId()) : null);

  // Handle drag
  const handleMouseDown = e => {
    if (e.target.closest('[data-drag-handle]')) {
      setIsDragging(true);
      const rect = e.currentTarget.getBoundingClientRect();
      setPanel('dragOffset', {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseMove = e => {
    if (isDragging()) {
      setPanel('position', {
        x: e.clientX - panel.dragOffset.x,
        y: e.clientY - panel.dragOffset.y,
      });
    }
    if (isResizing()) {
      const newWidth = Math.max(300, e.clientX - panel.position.x);
      const newHeight = Math.max(200, e.clientY - panel.position.y);
      setPanel('size', { width: newWidth, height: newHeight });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleResizeStart = e => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  };

  createEffect(() => {
    if (isDragging() || isResizing()) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    onCleanup(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });
  });

  const tabClass = isActive =>
    `flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
      isActive ?
        'text-purple-600 bg-white border-b-2 border-purple-600'
      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <Portal>
      {/* Floating toggle button */}
      <Show when={!isOpen()}>
        <button
          class='fixed bottom-5 left-5 z-9999 flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg transition-transform hover:scale-110 hover:bg-purple-700'
          onClick={() => setIsOpen(true)}
          title='Open Dev Panel'
        >
          <VsDebug size={20} />
        </button>
      </Show>

      {/* Main panel */}
      <Show when={isOpen()}>
        <div
          class='fixed z-9999 flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white font-mono text-xs shadow-xl'
          style={{
            left: `${panel.position.x}px`,
            top: `${panel.position.y}px`,
            width: `${panel.size.width}px`,
            height: isMinimized() ? 'auto' : `${panel.size.height}px`,
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Header */}
          <div
            data-drag-handle
            class='flex cursor-grab items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 select-none active:cursor-grabbing'
          >
            <div class='flex items-center gap-2 text-gray-600'>
              <VsDebug size={16} class='text-purple-600' />
              <span class='font-semibold text-gray-900'>Dev Panel</span>
              <Show
                when={isProjectContext()}
                fallback={
                  <span class='text-2xs rounded bg-blue-100 px-1.5 py-0.5 text-blue-600'>
                    Dashboard
                  </span>
                }
              >
                <span class='text-2xs rounded bg-gray-200 px-1.5 py-0.5 text-gray-500'>
                  {projectId()?.slice(0, 8)}...
                </span>
              </Show>
            </div>
            <div class='flex items-center gap-1'>
              <Show when={isProjectContext() && connectionState()?.connected}>
                <span class='text-2xs rounded bg-green-100 px-2 py-0.5 text-green-700'>
                  Connected
                </span>
              </Show>
              <button
                class='rounded p-1 text-gray-400 hover:bg-purple-100 hover:text-purple-600'
                onClick={() => navigate('/mocks')}
                title='Go to Mocks'
              >
                <FiLayout size={16} />
              </button>
              <button
                class='rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                onClick={() => setIsMinimized(!isMinimized())}
                title={isMinimized() ? 'Expand' : 'Minimize'}
              >
                <Show when={isMinimized()} fallback={<FiChevronUp size={16} />}>
                  <FiChevronDown size={16} />
                </Show>
              </button>
              <button
                class='rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                onClick={() => setIsOpen(false)}
                title='Close'
              >
                <FiX size={16} />
              </button>
            </div>
          </div>

          {/* Content */}
          <Show when={!isMinimized()}>
            {/* Tabs */}
            <div class='flex border-b border-gray-200 bg-gray-50'>
              {/* Always available tabs */}
              <button
                class={tabClass(activeTab() === 'import')}
                onClick={() => setActiveTab('import')}
              >
                Import
              </button>
              <button
                class={tabClass(activeTab() === 'toasts')}
                onClick={() => setActiveTab('toasts')}
              >
                Toasts
              </button>
              {/* Project-specific tabs */}
              <Show when={isProjectContext()}>
                <button
                  class={tabClass(activeTab() === 'tree')}
                  onClick={() => setActiveTab('tree')}
                >
                  State Tree
                </button>
                <button
                  class={tabClass(activeTab() === 'templates')}
                  onClick={() => setActiveTab('templates')}
                >
                  Templates
                </button>
                <button
                  class={tabClass(activeTab() === 'json')}
                  onClick={() => setActiveTab('json')}
                >
                  <VsJson size={14} />
                  JSON
                </button>
              </Show>
            </div>

            {/* Tab content */}
            <div class='flex-1 overflow-auto'>
              <Show when={activeTab() === 'import'}>
                <DevImportProject />
              </Show>

              <Show when={activeTab() === 'toasts'}>
                <DevToastTester />
              </Show>

              <Show when={activeTab() === 'tree' && isProjectContext()}>
                <DevStateTree projectId={projectId()} data={projectData()} />
              </Show>

              <Show when={activeTab() === 'templates' && isProjectContext()}>
                <div class='flex flex-col gap-4 p-3'>
                  <DevTemplateSelector projectId={projectId()} orgId={orgId()} />
                  <DevQuickActions projectId={projectId()} orgId={orgId()} />
                </div>
              </Show>

              <Show when={activeTab() === 'json' && isProjectContext()}>
                <DevJsonEditor projectId={projectId()} orgId={orgId()} data={projectData()} />
              </Show>
            </div>

            {/* Resize handle */}
            <div
              class='absolute right-0 bottom-0 h-4 w-4 cursor-se-resize'
              onMouseDown={handleResizeStart}
            >
              <svg class='h-4 w-4 text-gray-400' viewBox='0 0 16 16' fill='currentColor'>
                <path d='M14 14v-2h-2v2h2zm0-4v-2h-2v2h2zm-4 4v-2H8v2h2zm0-4v-2H8v2h2zm-4 4v-2H4v2h2z' />
              </svg>
            </div>
          </Show>
        </div>
      </Show>
    </Portal>
  );
}
