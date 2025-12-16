import { createSignal, createEffect, onCleanup, createContext, useContext } from 'solid-js';
import * as Y from 'yjs';
import { yToPlain, applyObjectToYMap } from '../lib/yjsUtils.js';

// Context for sharing the user's project connections across the app
const UserProjectsContext = createContext();

export function useUserProjects() {
  return useContext(UserProjectsContext);
}

export default function UserYjsProvider(props) {
  const [connected, setConnected] = createSignal(false);
  const [userProjects, setUserProjects] = createSignal([]);
  const [projectConnections, setProjectConnections] = createSignal({});
  const [projectData, setProjectData] = createSignal({});

  // Store WebSocket connections and Y.Docs for each project
  let connections = {};

  async function fetchUserProjects() {
    if (!props.userId) return;

    try {
      // Fetch user's projects from D1 via API
      const response = await fetch(`${props.apiBase}/api/users/${props.userId}/projects`, {
        credentials: 'include',
      });

      if (response.ok) {
        const projects = await response.json();
        setUserProjects(projects);

        // Connect to each project's Durable Object
        for (const project of projects) {
          await connectToProject(project.id);
        }

        setConnected(true);
      } else {
        console.error('Failed to fetch user projects:', response.statusText);
      }
    } catch (err) {
      console.error('Error fetching user projects:', err);
    }
  }

  async function connectToProject(projectId) {
    if (connections[projectId]) return; // Already connected

    // Don't attempt connection when offline
    if (!navigator.onLine) {
      return;
    }

    try {
      const ydoc = new Y.Doc();
      const wsUrl = props.apiBase.replace('http', 'ws') + `/api/project/${projectId}`;
      const ws = new WebSocket(wsUrl);

      connections[projectId] = { ws, ydoc, connected: false };

      ws.onopen = () => {
        connections[projectId].connected = true;
        setProjectConnections({ ...connections });
      };

      ws.onmessage = event => {
        const data = JSON.parse(event.data);
        if (data.type === 'sync' || data.type === 'update') {
          const update = new Uint8Array(data.update);
          Y.applyUpdate(ydoc, update);

          // Read project data and update state
          const checklists = ydoc.getMap('checklists');
          const projectPlainData = {};

          for (const [checklistId, checklistYMap] of checklists.entries()) {
            projectPlainData[checklistId] = yToPlain(checklistYMap);
          }

          setProjectData(prev => ({
            ...prev,
            [projectId]: { checklists: projectPlainData },
          }));
        }
      };

      ws.onclose = () => {
        if (connections[projectId]) {
          connections[projectId].connected = false;
          setProjectConnections({ ...connections });
        }
      };

      ws.onerror = () => {
        // Suppress error logging when offline to prevent console spam
        if (navigator.onLine) {
          console.error(`Project ${projectId} WebSocket error`);
        }
        if (connections[projectId]) {
          connections[projectId].connected = false;
          setProjectConnections({ ...connections });
        }
      };
    } catch (err) {
      console.error(`Failed to connect to project ${projectId}:`, err);
    }
  }

  function updateChecklist(projectId, checklistId, updates) {
    const connection = connections[projectId];
    if (!connection || !connection.connected) return;

    const { ydoc, ws } = connection;
    const checklistsMap = ydoc.getMap('checklists');

    if (!checklistsMap.has(checklistId)) {
      // Create new checklist
      const checklistMap = new Y.Map();
      applyObjectToYMap(checklistMap, updates);
      checklistsMap.set(checklistId, checklistMap);
    } else {
      // Update existing checklist
      const checklistMap = checklistsMap.get(checklistId);
      applyObjectToYMap(checklistMap, updates);
    }

    // Send update
    const update = Y.encodeStateAsUpdate(ydoc);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update', update: Array.from(update) }));
    }
  }

  function getChecklist(projectId, checklistId) {
    const project = projectData()[projectId];
    return project?.checklists?.[checklistId] || null;
  }

  function getProject(projectId) {
    return projectData()[projectId] || null;
  }

  function isProjectConnected(projectId) {
    return connections[projectId]?.connected || false;
  }

  createEffect(() => {
    fetchUserProjects();
  });

  onCleanup(() => {
    // Close all WebSocket connections
    Object.values(connections).forEach(({ ws }) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    connections = {};
  });

  const contextValue = {
    connected,
    userProjects,
    projectData,
    projectConnections,
    updateChecklist,
    getChecklist,
    getProject,
    isProjectConnected,
    connectToProject,
  };

  return (
    <UserProjectsContext.Provider value={contextValue}>
      {props.children}
    </UserProjectsContext.Provider>
  );
}
