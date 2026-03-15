/**
 * AddStudiesForm - Simplified version for adding studies to a project
 *
 * Currently supports manual study creation by name.
 * TODO(agent): Migrate full useAddStudies primitive (~1,500 LOC) to enable:
 * - PDF upload with metadata extraction
 * - DOI/PMID lookup
 * - Reference file import (RIS, BibTeX)
 * - Google Drive file picker
 */

import { useState, useCallback } from 'react';
import { PlusIcon, XIcon } from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { showToast } from '@/components/ui/toast';
import _projectActionsStore from '@/stores/projectActionsStore/index.js';

const projectActionsStore = _projectActionsStore as any;

/* eslint-disable no-unused-vars */
interface AddStudiesFormProps {
  projectId: string;
  formType?: string;
  initialState?: any;
  onSaveState?: (state: any) => Promise<void>;
  onAddStudies?: (studies: any[]) => Promise<void>;
}
/* eslint-enable no-unused-vars */

export function AddStudiesForm({ projectId }: AddStudiesFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [studyName, setStudyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddStudy = useCallback(async () => {
    const name = studyName.trim();
    if (!name) return;

    setIsSubmitting(true);
    try {
      const studyId = projectActionsStore.study.create(name, '', {});
      if (studyId) {
        setStudyName('');
        showToast.success('Study Added', `"${name}" has been added to the project.`);
      }
    } catch (err) {
      console.error('Failed to create study:', err);
      showToast.error('Failed to add study');
    } finally {
      setIsSubmitting(false);
    }
  }, [studyName]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddStudy();
      }
    },
    [handleAddStudy],
  );

  return (
    <div className="border-border bg-card overflow-hidden rounded-lg border">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        {/* Header */}
        <div
          className="flex cursor-pointer items-center justify-between px-4 py-3 select-none"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <PlusIcon className="text-primary h-5 w-5" />
            <span className="text-foreground font-medium">Add Studies</span>
          </div>
          <button
            onClick={e => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              expanded
                ? 'text-muted-foreground hover:bg-muted'
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
          >
            {expanded ? <XIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
            {expanded ? 'Close' : 'Add'}
          </button>
        </div>

        <CollapsibleContent>
          <div className="border-border space-y-4 border-t px-4 py-4">
            {/* Quick add by name */}
            <div>
              <label className="text-secondary-foreground mb-1 block text-sm font-medium">
                Study Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={studyName}
                  onChange={e => setStudyName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter study name or title..."
                  className="border-border focus:border-primary focus:ring-primary flex-1 rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                  disabled={isSubmitting}
                />
                <button
                  onClick={handleAddStudy}
                  disabled={!studyName.trim() || isSubmitting}
                  className="bg-primary hover:bg-primary/90 shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>

            {/* Advanced features notice */}
            <div className="border-border bg-muted/50 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">
                Advanced import options (PDF upload with metadata extraction, DOI/PMID lookup,
                reference file import, Google Drive) will be available after full migration.
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
