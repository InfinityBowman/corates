# Real Component Examples

Working examples from the CoRATES codebase demonstrating best practices.

## ProjectCard Component

Location: `packages/web/src/components/dashboard/ProjectCard.jsx`

A card component showing project info with computed stats and conditional rendering:

```jsx
import { createMemo, Show } from 'solid-js';
import { FiTrash2, FiUsers } from 'solid-icons/fi';
import { Tooltip } from '@corates/ui';
import projectStore from '@/stores/projectStore.js';

const ACCENT_COLORS = [
  { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700' },
  { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700' },
  // ... more colors
];

function hashToColorIndex(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % ACCENT_COLORS.length;
}

export function ProjectCard(props) {
  // Computed color based on project ID
  const colors = createMemo(() => {
    const index = hashToColorIndex(props.project?.id);
    return ACCENT_COLORS[index];
  });

  // Computed progress from store or props fallback
  const progress = createMemo(() => {
    const cachedStats = projectStore.getProjectStats(props.project?.id);
    const completed = cachedStats?.completedCount ?? props.project?.completedCount ?? 0;
    const total = cachedStats?.studyCount ?? props.project?.studyCount ?? 0;

    if (total === 0) return { completed: 0, total: 0, percentage: 0 };

    return {
      completed,
      total,
      percentage: Math.round((completed / total) * 100),
    };
  });

  // Simple derived value as arrow function
  const isOwner = () => props.project?.role === 'owner';

  return (
    <div
      class='group relative cursor-pointer rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md'
      onClick={() => props.onSelect?.(props.project)}
    >
      {/* Color accent bar */}
      <div class={`absolute top-0 left-0 h-1 w-full rounded-t-xl ${colors().bg}`} />

      {/* Header with title and delete button */}
      <div class='mb-3 flex items-start justify-between'>
        <h3 class='line-clamp-2 font-semibold text-gray-900'>{props.project?.title || 'Untitled Project'}</h3>

        <Show when={isOwner() && props.onDelete}>
          <Tooltip content='Delete project'>
            <button
              onClick={e => {
                e.stopPropagation();
                props.onDelete?.(props.project?.id);
              }}
              class='p-1 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500'
            >
              <FiTrash2 class='h-4 w-4' />
            </button>
          </Tooltip>
        </Show>
      </div>

      {/* Progress section */}
      <div class='space-y-2'>
        <div class='flex items-center justify-between text-sm'>
          <span class='text-gray-500'>Progress</span>
          <span class={colors().text}>{progress().percentage}%</span>
        </div>

        <div class='h-2 w-full rounded-full bg-gray-100'>
          <div
            class={`h-full rounded-full ${colors().bg} transition-all`}
            style={{ width: `${progress().percentage}%` }}
          />
        </div>

        <div class='flex items-center justify-between text-xs text-gray-500'>
          <span>
            {progress().completed} / {progress().total} studies
          </span>
          <Show when={props.project?.memberCount > 1}>
            <span class='flex items-center gap-1'>
              <FiUsers class='h-3 w-3' />
              {props.project.memberCount}
            </span>
          </Show>
        </div>
      </div>
    </div>
  );
}
```

Key patterns:

- Props accessed directly via `props.project`, `props.onDelete`, etc.
- `createMemo` for computed values that derive from props
- Arrow functions for simple boolean checks: `isOwner()`
- Store imported directly for additional data
- Icons from solid-icons
- Tooltip from @corates/ui
- Event handler stops propagation and calls prop handler

---

## StatsRow Component

Location: `packages/web/src/components/dashboard/StatsRow.jsx`

A row of stat cards using context for animations:

```jsx
import { For, useContext } from 'solid-js';
import { FiFolder, FiCheck, FiFileText, FiUsers } from 'solid-icons/fi';
import { AnimationContext } from './Dashboard.jsx';

export function StatsRow(props) {
  const animation = useContext(AnimationContext);

  // Computed stats array with icons
  const stats = () => [
    {
      label: 'Active Projects',
      value: props.projectCount ?? 0,
      icon: <FiFolder class='h-5 w-5 text-blue-600' />,
      iconBg: 'bg-blue-50',
    },
    {
      label: 'Studies Reviewed',
      value: `${props.completedStudies ?? 0}/${props.totalStudies ?? 0}`,
      icon: <FiCheck class='h-5 w-5 text-emerald-600' />,
      iconBg: 'bg-emerald-50',
    },
    {
      label: 'Local Appraisals',
      value: props.localAppraisalCount ?? 0,
      icon: <FiFileText class='h-5 w-5 text-purple-600' />,
      iconBg: 'bg-purple-50',
    },
    {
      label: 'Team Members',
      value: props.teamMemberCount ?? '-',
      icon: <FiUsers class='h-5 w-5 text-amber-600' />,
      iconBg: 'bg-amber-50',
    },
  ];

  return (
    <section class='grid grid-cols-2 gap-4 lg:grid-cols-4' style={animation.fadeUp(100)}>
      <For each={stats()}>{(stat, index) => <StatCard stat={stat} index={index()} animation={animation} />}</For>
    </section>
  );
}

export function StatCard(props) {
  return (
    <div
      class='rounded-xl border border-gray-100 bg-white p-4 shadow-sm'
      style={props.animation?.statRise(props.index)}
    >
      <div class='flex items-center gap-3'>
        <div class={`rounded-lg p-2 ${props.stat.iconBg}`}>{props.stat.icon}</div>
        <div>
          <p class='text-2xl font-bold text-gray-900'>{props.stat.value}</p>
          <p class='text-sm text-gray-500'>{props.stat.label}</p>
        </div>
      </div>
    </div>
  );
}
```

Key patterns:

- Context used for animation values (not prop drilling)
- Stats computed as array with JSX icons
- Props accessed directly: `props.projectCount`, `props.stat.label`
- For loop with index for staggered animations
- Small, focused components (StatsRow + StatCard)

---

## Sidebar Component (Excerpt)

Location: `packages/web/src/components/sidebar/Sidebar.jsx`

Demonstrates local state, effects, and cleanup:

```jsx
import { createSignal, createEffect, onMount, onCleanup, Show, For } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';
import { FiPlus, FiChevronLeft, FiChevronRight } from 'solid-icons/fi';
import { useConfirmDialog, Tooltip } from '@corates/ui';
import projectStore from '@/stores/projectStore.js';
import localChecklistsStore from '@/stores/localChecklistsStore.js';

export default function Sidebar(props) {
  const navigate = useNavigate();
  const params = useParams();
  const confirmDialog = useConfirmDialog();

  // Local UI state
  const [expandedProjects, setExpandedProjects] = createSignal({});
  const [isResizing, setIsResizing] = createSignal(false);
  const [width, setWidth] = createSignal(280);

  // Read from stores directly
  const projects = () => projectStore.store.projectList ?? [];
  const localChecklists = () => localChecklistsStore.checklists();

  // Toggle expand state
  const toggleProject = projectId => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  // Handle resize with cleanup
  onMount(() => {
    const handleMouseMove = e => {
      if (!isResizing()) return;
      const newWidth = Math.max(200, Math.min(400, e.clientX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    onCleanup(() => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });
  });

  // Delete with confirmation
  const handleDeleteChecklist = async checklistId => {
    const confirmed = await confirmDialog.confirm({
      title: 'Delete Checklist?',
      message: 'This action cannot be undone.',
    });

    if (confirmed) {
      await localChecklistsStore.deleteChecklist(checklistId);
    }
  };

  return (
    <aside class='flex h-full flex-col border-r border-gray-200 bg-white' style={{ width: `${width()}px` }}>
      {/* Header */}
      <div class='flex items-center justify-between border-b border-gray-100 p-4'>
        <h2 class='font-semibold text-gray-900'>Projects</h2>
        <Tooltip content='New project'>
          <button onClick={() => navigate('/projects/new')} class='rounded-lg p-1.5 text-gray-500 hover:bg-gray-100'>
            <FiPlus class='h-4 w-4' />
          </button>
        </Tooltip>
      </div>

      {/* Project list */}
      <div class='flex-1 overflow-y-auto p-2'>
        <For each={projects()}>
          {project => (
            <ProjectTreeItem
              project={project}
              isExpanded={expandedProjects()[project.id]}
              onToggle={() => toggleProject(project.id)}
              isActive={params.projectId === project.id}
            />
          )}
        </For>
      </div>

      {/* Resize handle */}
      <div
        class='absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-blue-500'
        onMouseDown={() => setIsResizing(true)}
      />
    </aside>
  );
}
```

Key patterns:

- Multiple local signals for UI state
- Store imports for data (no prop drilling)
- onMount + onCleanup for event listeners
- useConfirmDialog hook from @corates/ui
- Navigate with @solidjs/router
- Props accessed directly: `params.projectId`

---

## Navbar Component (Excerpt)

Location: `packages/web/src/components/Navbar.jsx`

Shows auth integration and click-outside handling:

```jsx
import { createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { FiMenu, FiLogOut, FiSettings, FiChevronDown } from 'solid-icons/fi';
import { Avatar } from '@corates/ui';
import { user, authLoading, signOut } from '@/stores/authStore.js';
import { isAdmin, isAdminChecked, checkAdminStatus } from '@/stores/adminStore.js';

export default function Navbar(props) {
  const navigate = useNavigate();
  let userMenuRef;

  const [showUserMenu, setShowUserMenu] = createSignal(false);

  // Persist user name for faster perceived load
  const storedName = localStorage.getItem('userName');

  createEffect(() => {
    if (user()) {
      localStorage.setItem('userName', user().name);
    } else if (!authLoading()) {
      localStorage.removeItem('userName');
    }
  });

  // Click outside to close menu
  onMount(async () => {
    const handleClickOutside = event => {
      if (userMenuRef && !userMenuRef.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    onCleanup(() => {
      document.removeEventListener('mousedown', handleClickOutside);
    });

    await checkAdminStatus();
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const showAdminMenu = () => isAdmin() && isAdminChecked();

  return (
    <nav class='flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4'>
      {/* Mobile menu toggle - only shown if prop provided */}
      <Show when={props.toggleMobileSidebar}>
        <button
          onClick={() => props.toggleMobileSidebar?.()}
          class='rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden'
          aria-label={props.mobileSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <FiMenu class='h-5 w-5' />
        </button>
      </Show>

      {/* User menu */}
      <div class='relative ml-auto' ref={userMenuRef}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu())}
          class='flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100'
        >
          <Avatar src={user()?.image} name={user()?.name || storedName} class='h-7 w-7 rounded-full' />
          <span class='hidden text-sm font-medium text-gray-700 sm:block'>{user()?.name || storedName}</span>
          <FiChevronDown class={`h-4 w-4 text-gray-500 transition-transform ${showUserMenu() ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown menu */}
        <Show when={showUserMenu()}>
          <div class='absolute top-full right-0 mt-1 w-48 rounded-lg border border-gray-100 bg-white py-1 shadow-lg'>
            <Show when={showAdminMenu()}>
              <button
                onClick={() => {
                  navigate('/admin');
                  setShowUserMenu(false);
                }}
                class='flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50'
              >
                <FiSettings class='h-4 w-4' />
                Admin Panel
              </button>
            </Show>
            <button
              onClick={handleSignOut}
              class='flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50'
            >
              <FiLogOut class='h-4 w-4' />
              Sign Out
            </button>
          </div>
        </Show>
      </div>
    </nav>
  );
}
```

Key patterns:

- Auth store imported directly (not prop drilled)
- Ref for click-outside detection
- Effect for localStorage sync
- Props accessed directly: `props.toggleMobileSidebar`, `props.mobileSidebarOpen`
- Optional chaining when calling prop handlers: `props.toggleMobileSidebar?.()`
- Avatar from @corates/ui
- Icons from solid-icons/fi
