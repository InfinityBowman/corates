/**
 * ToDoTab - Studies assigned to the current user with pending checklists
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ListTodoIcon } from 'lucide-react';
import { TodoStudyRow } from './TodoStudyRow';
import { useProjectStore, selectStudies, selectMembers, selectConnectionState } from '@/stores/projectStore';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { useProjectContext } from '../ProjectContext';
import { getStudiesForTab } from '@/lib/checklist-domain.js';
import _projectActionsStore from '@/stores/projectActionsStore/index.js';

const projectActionsStore = _projectActionsStore as any;

export function ToDoTab() {
  const { projectId, getChecklistPath } = useProjectContext();
  const user = useAuthStore(selectUser);
  const navigate = useNavigate();

  const [showChecklistForm, setShowChecklistForm] = useState<string | null>(null);
  const [expandedStudies, setExpandedStudies] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((studyId: string) => {
    setExpandedStudies(prev => {
      const next = new Set(prev);
      if (next.has(studyId)) next.delete(studyId);
      else next.add(studyId);
      return next;
    });
  }, []);

  const studies = useProjectStore(s => selectStudies(s, projectId));
  const members = useProjectStore(s => selectMembers(s, projectId));
  const connectionState = useProjectStore(s => selectConnectionState(s, projectId));
  const hasData = connectionState.synced || studies.length > 0;
  const currentUserId = user?.id;

  const myStudies = useMemo(() => {
    if (!currentUserId) return [];
    return getStudiesForTab(studies, 'todo', currentUserId);
  }, [studies, currentUserId]);

  const handleCreateChecklist = useCallback(
    (studyId: string, type: string, assigneeId: string, outcomeId: string | null) => {
      try {
        const success = projectActionsStore.checklist.create(studyId, type, assigneeId, outcomeId);
        if (success) setShowChecklistForm(null);
      } catch (err) {
        console.error('Failed to create checklist:', err);
      }
    },
    [],
  );

  const openChecklist = useCallback(
    (studyId: string, checklistId: string) => {
      navigate({ to: getChecklistPath(studyId, checklistId, 'todo') as string });
    },
    [navigate, getChecklistPath],
  );

  return (
    <div className='space-y-2'>
      {myStudies.length > 0 ?
        myStudies.map((study: any) => (
          <TodoStudyRow
            key={study.id}
            study={study}
            members={members}
            currentUserId={currentUserId || ''}
            expanded={expandedStudies.has(study.id)}
            onToggleExpanded={() => toggleExpanded(study.id)}
            showChecklistForm={showChecklistForm === study.id}
            onToggleChecklistForm={() =>
              setShowChecklistForm(prev => (prev === study.id ? null : study.id))
            }
            onAddChecklist={(type, assigneeId, outcomeId) =>
              handleCreateChecklist(study.id, type, assigneeId, outcomeId)
            }
            onOpenChecklist={checklistId => openChecklist(study.id, checklistId)}
            onDeleteChecklist={checklistId =>
              projectActionsStore.checklist.delete(study.id, checklistId)
            }
            onViewPdf={pdf => projectActionsStore.pdf.view(study.id, pdf)}
            onDownloadPdf={pdf => projectActionsStore.pdf.download(study.id, pdf)}
            creatingChecklist={false}
          />
        ))
      : hasData && (
          <div className='py-16 text-center'>
            <ListTodoIcon className='text-muted-foreground/50 mx-auto mb-4 h-12 w-12' />
            <h3 className='text-foreground mb-2 text-lg font-medium'>To Do</h3>
            <p className='text-muted-foreground mx-auto max-w-md'>
              Studies assigned to you will appear here. Complete your appraisals to move them to the
              next stage.
            </p>
          </div>
        )
      }
    </div>
  );
}
