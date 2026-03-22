/**
 * DevPanel - Floating development panel for Yjs state inspection
 *
 * Only rendered when DEV mode is enabled (VITE_DEV_PANEL=true).
 * Context-aware: shows different tools based on current route.
 * - Dashboard: Import Project from JSON
 * - Project view: State tree, templates, JSON export/import
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XIcon, ChevronDownIcon, ChevronUpIcon, BugIcon, BracesIcon } from 'lucide-react';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import { useProjectOrgId } from '@/hooks/useProjectOrgId';
import { DevStateTree } from './DevStateTree';
import { DevTemplateSelector } from './DevTemplateSelector';
import { DevQuickActions } from './DevQuickActions';
import { DevJsonEditor } from './DevJsonEditor';
import { DevImportProject } from './DevImportProject';
import { DevToastTester } from './DevToastTester';

type TabId = 'import' | 'toasts' | 'tree' | 'templates' | 'json';

function getProjectIdFromUrl(): string | null {
  const match = window.location.pathname.match(/\/projects\/([^/]+)/);
  return match ? match[1] : null;
}

export function DevPanel() {
  const [projectId, setProjectId] = useState<string | null>(getProjectIdFromUrl);

  // Re-detect projectId on URL changes
  useEffect(() => {
    const handlePopState = () => setProjectId(getProjectIdFromUrl());

    // Also observe pushState/replaceState via a periodic check since
    // there is no native event for programmatic navigation
    const interval = setInterval(() => {
      const currentId = getProjectIdFromUrl();
      setProjectId(prev => (prev !== currentId ? currentId : prev));
    }, 500);

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      clearInterval(interval);
    };
  }, []);

  const isProjectContext = !!projectId;

  const orgId = useProjectOrgId(projectId);

  const projectData = useProjectStore(s => (projectId ? s.projects[projectId] || null : null));

  const connectionState = useProjectStore(s =>
    projectId ? selectConnectionPhase(s, projectId) : null,
  );

  const [isOpen, setIsOpen] = useState(false);
  const [userSelectedTab, setUserSelectedTab] = useState<TabId | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Derive the active tab from user selection and context, no useEffect needed
  const activeTab: TabId = (() => {
    const tab = userSelectedTab;
    // If no tab selected yet, default based on context
    if (tab === null) {
      return isProjectContext ? 'tree' : 'import';
    }
    // If we left project context but are on a project-only tab, switch to import
    if (!isProjectContext && (tab === 'tree' || tab === 'templates' || tab === 'json')) {
      return 'import';
    }
    // If we entered project context and are on import tab, switch to tree
    if (isProjectContext && tab === 'import') {
      return 'tree';
    }
    return tab;
  })();

  const setActiveTab = (tab: TabId) => setUserSelectedTab(tab);

  // Panel geometry
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [size, setSize] = useState({ width: 420, height: 500 });

  // Drag/resize state tracked via refs to avoid re-render overhead
  const dragStateRef = useRef({
    isDragging: false,
    isResizing: false,
    dragOffset: { x: 0, y: 0 },
    position: { x: 20, y: 20 },
  });

  // Keep position ref in sync for resize calculations
  useEffect(() => {
    dragStateRef.current.position = position;
  }, [position]);

  const attachListenersRef = useRef<() => void>(() => {});

  // Single effect to manage document-level mouse listeners for drag/resize
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const ds = dragStateRef.current;
      if (ds.isDragging) {
        setPosition({
          x: e.clientX - ds.dragOffset.x,
          y: e.clientY - ds.dragOffset.y,
        });
      }
      if (ds.isResizing) {
        setSize({
          width: Math.max(300, e.clientX - ds.position.x),
          height: Math.max(200, e.clientY - ds.position.y),
        });
      }
    };

    const onMouseUp = () => {
      dragStateRef.current.isDragging = false;
      dragStateRef.current.isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    attachListenersRef.current = () => {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-drag-handle]')) {
      dragStateRef.current.isDragging = true;
      const rect = e.currentTarget.getBoundingClientRect();
      dragStateRef.current.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      attachListenersRef.current();
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragStateRef.current.isResizing = true;
    attachListenersRef.current();
  };

  const tabClass = (isActive: boolean) =>
    `flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
      isActive ?
        'text-purple-600 bg-card border-b-2 border-purple-600'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
    }`;

  return createPortal(
    <>
      {/* Floating toggle button */}
      {!isOpen && (
        <button
          className='fixed bottom-5 left-5 z-9999 flex size-12 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg transition-transform hover:scale-110 hover:bg-purple-700'
          onClick={() => setIsOpen(true)}
          title='Open Dev Panel'
        >
          <BugIcon size={20} />
        </button>
      )}

      {/* Main panel */}
      {isOpen && (
        <div
          className='border-border bg-card fixed z-9999 flex flex-col overflow-hidden rounded-lg border font-mono text-xs shadow-xl'
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: isMinimized ? 'auto' : `${size.height}px`,
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Header */}
          <div
            data-drag-handle
            className='border-border bg-muted flex cursor-grab items-center justify-between border-b px-3 py-2 select-none active:cursor-grabbing'
          >
            <div className='text-muted-foreground flex items-center gap-2'>
              <BugIcon size={16} className='text-purple-600' />
              <span className='text-foreground font-semibold'>Dev Panel</span>
              {isProjectContext ?
                <span className='text-2xs bg-muted text-muted-foreground rounded px-1.5 py-0.5'>
                  {projectId?.slice(0, 8)}...
                </span>
              : <span className='text-2xs rounded bg-blue-100 px-1.5 py-0.5 text-blue-600'>
                  Dashboard
                </span>
              }
            </div>
            <div className='flex items-center gap-1'>
              {isProjectContext && connectionState?.phase === 'connecting' && (
                <span className='text-2xs bg-warning-bg text-warning-foreground rounded px-2 py-0.5'>
                  Connecting...
                </span>
              )}
              {isProjectContext && (connectionState?.phase === 'connected' || connectionState?.phase === 'synced') && (
                <span className='text-2xs bg-success-bg text-success rounded px-2 py-0.5'>
                  Connected
                </span>
              )}
              {isProjectContext && connectionState?.phase !== 'connected' && connectionState?.phase !== 'synced' && connectionState?.phase !== 'connecting' && (
                <span className='text-2xs rounded bg-red-100 px-2 py-0.5 text-red-700'>
                  Disconnected
                </span>
              )}
              <button
                className='text-muted-foreground hover:bg-muted hover:text-muted-foreground rounded p-1'
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ?
                  <ChevronDownIcon size={16} />
                : <ChevronUpIcon size={16} />}
              </button>
              <button
                className='text-muted-foreground hover:bg-muted hover:text-muted-foreground rounded p-1'
                onClick={() => setIsOpen(false)}
                title='Close'
              >
                <XIcon size={16} />
              </button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <>
              {/* Tabs */}
              <div className='border-border bg-muted flex border-b'>
                {/* Always available tabs */}
                <button
                  className={tabClass(activeTab === 'import')}
                  onClick={() => setActiveTab('import')}
                >
                  Import
                </button>
                <button
                  className={tabClass(activeTab === 'toasts')}
                  onClick={() => setActiveTab('toasts')}
                >
                  Toasts
                </button>
                {/* Project-specific tabs */}
                {isProjectContext && (
                  <>
                    <button
                      className={tabClass(activeTab === 'tree')}
                      onClick={() => setActiveTab('tree')}
                    >
                      State Tree
                    </button>
                    <button
                      className={tabClass(activeTab === 'templates')}
                      onClick={() => setActiveTab('templates')}
                    >
                      Templates
                    </button>
                    <button
                      className={tabClass(activeTab === 'json')}
                      onClick={() => setActiveTab('json')}
                    >
                      <BracesIcon size={14} />
                      JSON
                    </button>
                  </>
                )}
              </div>

              {/* Tab content */}
              <div className='flex-1 overflow-auto'>
                {activeTab === 'import' && <DevImportProject />}

                {activeTab === 'toasts' && <DevToastTester />}

                {activeTab === 'tree' && isProjectContext && <DevStateTree data={projectData} />}

                {activeTab === 'templates' && isProjectContext && (
                  <div className='flex flex-col gap-4 p-3'>
                    <DevTemplateSelector projectId={projectId} orgId={orgId} />
                    <DevQuickActions projectId={projectId} orgId={orgId} />
                  </div>
                )}

                {activeTab === 'json' && isProjectContext && (
                  <DevJsonEditor projectId={projectId} orgId={orgId} data={projectData} />
                )}
              </div>

              {/* Resize handle */}
              <div
                className='absolute right-0 bottom-0 size-4 cursor-se-resize'
                onMouseDown={handleResizeStart}
              >
                <svg
                  className='text-muted-foreground size-4'
                  viewBox='0 0 16 16'
                  fill='currentColor'
                >
                  <path d='M14 14v-2h-2v2h2zm0-4v-2h-2v2h2zm-4 4v-2H8v2h2zm0-4v-2H8v2h2zm-4 4v-2H4v2h2z' />
                </svg>
              </div>
            </>
          )}
        </div>
      )}
    </>,
    document.body,
  );
}
