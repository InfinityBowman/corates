import { type ReactNode } from 'react';
import { useProjectReactor, useSortedStudyIds } from '../reactor/hooks';
import * as Y from 'yjs';

let counter = 0;

function getStudyMap(ydoc: Y.Doc, studyId: string): Y.Map<unknown> | undefined {
  return ydoc.getMap('reviews').get(studyId) as Y.Map<unknown> | undefined;
}

function getChecklistMap(
  ydoc: Y.Doc,
  studyId: string,
  checklistId: string,
): Y.Map<unknown> | undefined {
  const study = getStudyMap(ydoc, studyId);
  if (!study) return undefined;
  const checklists = study.get('checklists') as Y.Map<unknown> | undefined;
  return checklists?.get(checklistId) as Y.Map<unknown> | undefined;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{children}</div>
    </div>
  );
}

function Btn({
  onClick,
  children,
  variant,
}: {
  onClick: () => void;
  children: ReactNode;
  variant?: 'muted';
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: 11,
        border: '1px solid #d1d5db',
        borderRadius: 4,
        background: variant === 'muted' ? '#f3f4f6' : '#fff',
        color: variant === 'muted' ? '#888' : '#333',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export function MutationConsole() {
  const { ydoc } = useProjectReactor();
  const studyIds = useSortedStudyIds();

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        Mutations
      </div>
      <p style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>
        Each button mutates one field on the Y.Doc. Watch which components
        flash green on the left. Muted buttons change data nothing reads.
      </p>

      {studyIds.map((studyId) => {
        const clMap = getStudyMap(ydoc, studyId)?.get('checklists') as Y.Map<unknown> | undefined;
        const clIds = clMap ? [...clMap.keys()] : [];

        return (
          <div
            key={studyId}
            style={{ marginBottom: 14, padding: 8, border: '1px solid #f0f0f0', borderRadius: 6 }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
              {studyId}
            </div>

            <Section title="Study fields">
              <Btn onClick={() => {
                const m = getStudyMap(ydoc, studyId);
                m?.set('name', `Renamed ${++counter}`);
              }}>
                name
              </Btn>
              <Btn onClick={() => {
                const m = getStudyMap(ydoc, studyId);
                if (m) m.set('reviewer1', m.get('reviewer1') === 'alice' ? 'bob' : 'alice');
              }}>
                reviewer1
              </Btn>
              <Btn onClick={() => {
                const m = getStudyMap(ydoc, studyId);
                if (m) m.set('reviewer2', m.get('reviewer2') ? null : 'carol');
              }}>
                reviewer2
              </Btn>
              <Btn variant="muted" onClick={() => {
                const m = getStudyMap(ydoc, studyId);
                m?.set('firstAuthor', `Author-${++counter}`);
              }}>
                firstAuthor (hidden)
              </Btn>
            </Section>

            {clIds.length > 0 && (
              <Section title="Checklists">
                {clIds.map((clId) => (
                  <span key={clId} style={{ display: 'contents' }}>
                    <Btn onClick={() => {
                      const cl = getChecklistMap(ydoc, studyId, clId);
                      if (!cl) return;
                      const cur = cl.get('status') as string;
                      const next = cur === 'pending' ? 'in_progress'
                        : cur === 'in_progress' ? 'finalized' : 'pending';
                      cl.set('status', next);
                    }}>
                      {clId} status
                    </Btn>
                    <Btn variant="muted" onClick={() => {
                      const cl = getChecklistMap(ydoc, studyId, clId);
                      if (!cl) return;
                      const answers = cl.get('answers') as Y.Map<unknown> | undefined;
                      if (!answers) return;
                      const key = 'q1.verdict';
                      answers.set(key, answers.get(key) === 'Yes' ? 'No' : 'Yes');
                    }}>
                      {clId} verdict (flat)
                    </Btn>
                  </span>
                ))}
              </Section>
            )}
          </div>
        );
      })}

      <Section title="Structure">
        <Btn onClick={() => {
          const reviewsMap = ydoc.getMap('reviews');
          const id = `study-${++counter}`;
          ydoc.transact(() => {
            const study = new Y.Map();
            study.set('name', `New Study ${counter}`);
            study.set('firstAuthor', 'Doe');
            study.set('publicationYear', '2025');
            study.set('reviewer1', null);
            study.set('reviewer2', null);
            study.set('createdAt', Date.now());
            study.set('checklists', new Y.Map());
            reviewsMap.set(id, study);
          });
        }}>
          + study
        </Btn>
        <Btn onClick={() => {
          const reviewsMap = ydoc.getMap('reviews');
          const ids = [...reviewsMap.keys()];
          if (ids.length > 0) reviewsMap.delete(ids[ids.length - 1]);
        }}>
          - last study
        </Btn>
        <Btn onClick={() => {
          const sid = studyIds[0];
          if (!sid) return;
          const study = getStudyMap(ydoc, sid);
          const checklists = study?.get('checklists') as Y.Map<unknown>;
          if (!checklists) return;
          const id = `cl-${++counter}`;
          const cl = new Y.Map();
          cl.set('type', 'ROB2');
          cl.set('status', 'pending');
          cl.set('assignedTo', null);
          cl.set('createdAt', Date.now());
          cl.set('answers', new Y.Map());
          checklists.set(id, cl);
        }}>
          + checklist (first study)
        </Btn>
      </Section>
    </div>
  );
}
