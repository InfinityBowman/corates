import { useState } from 'react';
import * as Y from 'yjs';
import { ProjectReactor } from './reactor/core';
import { ProjectReactorContext } from './reactor/context';
import { useChecklistIds } from './reactor/hooks';
import { StudyList } from './components/StudyList';
import { AMSTAR2Form } from './components/AMSTAR2Form';
import { MutationConsole } from './components/MutationConsole';
import { StatsPanel } from './components/StatsPanel';
import { seedYDoc } from './seed';

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
        <AMSTAR2Form key={clId} studyId={studyId} checklistId={clId} />
      ))}
    </div>
  );
}

export default function App() {
  const [reactor] = useState(() => {
    const ydoc = new Y.Doc();
    seedYDoc(ydoc);
    return new ProjectReactor(ydoc);
  });

  const [selectedStudyId, setSelectedStudyId] = useState<string | null>('study-1');

  return (
    <ProjectReactorContext.Provider value={reactor}>
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>Reactor Prototype</h1>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 20 }}>
          Three data paths demonstrated: (1) Reactor for rendering -- per-field atoms via Y.Map.observe.
          (2) Y.Text for collaborative editing -- direct subscription, invisible to reactor.
          (3) Snapshot for export -- on-demand POJO read from Y.Map. Green flash = re-render.
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
