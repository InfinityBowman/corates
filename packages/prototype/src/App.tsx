import { useState, useEffect } from 'react';
import { DexieYProvider } from 'y-dexie';
import { ProjectReactor } from './reactor/core';
import { ProjectReactorContext } from './reactor/context';
import { useChecklistIds, useChecklistField } from './reactor/hooks';
import { StudyList } from './components/StudyList';
import { AMSTAR2Form } from './components/AMSTAR2Form';
import { ROB2Form } from './components/ROB2Form';
import { ROBINSIForm } from './components/ROBINSIForm';
import { MutationConsole } from './components/MutationConsole';
import { StatsPanel } from './components/StatsPanel';
import { seedYDoc } from './seed';
import { db } from './db';

const PROJECT_ID = 'prototype-1';

function ChecklistForm({ studyId, checklistId }: { studyId: string; checklistId: string }) {
  const type = useChecklistField(studyId, checklistId, 'type');
  if (type === 'ROB2') return <ROB2Form studyId={studyId} checklistId={checklistId} />;
  if (type === 'ROBINS_I') return <ROBINSIForm studyId={studyId} checklistId={checklistId} />;
  return <AMSTAR2Form studyId={studyId} checklistId={checklistId} />;
}

function EditorPanel({
  studyId,
}: {
  studyId: string;
}) {
  const checklistIds = useChecklistIds(studyId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>
        Editor: {studyId}
      </div>
      {checklistIds.length === 0 && (
        <div style={{ fontSize: 13, color: '#888' }}>No checklists on this study.</div>
      )}
      {checklistIds.map((clId) => (
        <ChecklistForm key={clId} studyId={studyId} checklistId={clId} />
      ))}
    </div>
  );
}

function LoadedApp({ reactor }: { reactor: ProjectReactor }) {
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>('study-1');

  return (
    <ProjectReactorContext.Provider value={reactor}>
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>Reactor Prototype</h1>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>
          Three data paths demonstrated: (1) Reactor for rendering -- per-field atoms via Y.Map.observe.
          (2) Y.Text for collaborative editing -- direct subscription, invisible to reactor.
          (3) Snapshot for export -- on-demand POJO read from Y.Map.
          Data persists to IndexedDB via y-dexie (single Y.Doc, no bridge).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Studies</div>
            <StudyList
              selectedStudyId={selectedStudyId}
              onSelectStudy={setSelectedStudyId}
            />
          </div>

          <div>
            {selectedStudyId ? (
              <EditorPanel studyId={selectedStudyId} />
            ) : (
              <div style={{ color: '#888', fontSize: 13 }}>
                Click a study to edit its checklists.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <StatsPanel />
            <MutationConsole />
          </div>
        </div>
      </div>
    </ProjectReactorContext.Provider>
  );
}

export default function App() {
  const [reactor, setReactor] = useState<ProjectReactor | null>(null);

  useEffect(() => {
    let disposed = false;
    let provider: ReturnType<typeof DexieYProvider.load> | null = null;
    let r: ProjectReactor | null = null;

    (async () => {
      const existing = await (db.projects as any).get(PROJECT_ID);
      if (!existing) {
        await (db.projects as any).put({ id: PROJECT_ID, updatedAt: Date.now() });
      }

      const project = await (db.projects as any).get(PROJECT_ID);
      provider = DexieYProvider.load(project.ydoc);
      await provider.whenLoaded;

      if (disposed) return;

      const ydoc = project.ydoc;
      const reviewsMap = ydoc.getMap('reviews');
      if (reviewsMap.size === 0) {
        seedYDoc(ydoc);
      }

      r = new ProjectReactor(ydoc);
      setReactor(r);
    })();

    return () => {
      disposed = true;
      r?.dispose();
      if (provider) DexieYProvider.release((provider as any).doc);
    };
  }, []);

  if (!reactor) {
    return (
      <div style={{ padding: 24, fontFamily: '-apple-system, sans-serif', color: '#888' }}>
        Loading from IndexedDB...
      </div>
    );
  }

  return <LoadedApp reactor={reactor} />;
}
