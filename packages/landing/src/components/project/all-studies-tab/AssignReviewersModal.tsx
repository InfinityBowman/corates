/**
 * AssignReviewersModal - Assign reviewer 1 and reviewer 2 to a study
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { UserIcon } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/* eslint-disable no-unused-vars */
interface AssignReviewersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  study: any;
  projectId: string;
  onSave: (studyId: string, updates: { reviewer1: string | null; reviewer2: string | null }) => void;
}
/* eslint-enable no-unused-vars */

export function AssignReviewersModal({
  open,
  onOpenChange,
  study,
  projectId,
  onSave,
}: AssignReviewersModalProps) {
  const [reviewer1, setReviewer1] = useState('');
  const [reviewer2, setReviewer2] = useState('');
  const [saving, setSaving] = useState(false);

  const members: any[] = useProjectStore(s => s.projects[projectId]?.members || []);
  const studies: any[] = useProjectStore(s => s.projects[projectId]?.studies || []);

  // Get latest study data from store
  const currentStudy = useMemo(
    () => (study?.id ? studies.find((s: any) => s.id === study.id) : null),
    [study?.id, studies],
  );

  const memberItems = useMemo(
    () => [
      { label: 'Unassigned', value: '_unassigned' },
      ...members.map((m: any) => ({
        label: m.name || m.email || 'Unknown',
        value: m.userId,
      })),
    ],
    [members],
  );

  // Reset form when modal opens or study changes
  useEffect(() => {
    if (open && currentStudy) {
      setReviewer1(currentStudy.reviewer1 || '_unassigned');
      setReviewer2(currentStudy.reviewer2 || '_unassigned');
    } else if (!open) {
      setReviewer1('_unassigned');
      setReviewer2('_unassigned');
    }
  }, [open, currentStudy]);

  const handleSave = useCallback(async () => {
    if (!currentStudy) return;
    if (reviewer1 !== '_unassigned' && reviewer1 === reviewer2) {
      const { showToast } = await import('@/components/ui/toast');
      showToast.error('Invalid Assignment', 'Reviewer 1 and Reviewer 2 must be different.');
      return;
    }
    setSaving(true);
    try {
      onSave(currentStudy.id, {
        reviewer1: reviewer1 === '_unassigned' ? null : reviewer1,
        reviewer2: reviewer2 === '_unassigned' ? null : reviewer2,
      });
      onOpenChange(false);
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils.js');
      await handleError(err, { toastTitle: 'Update Failed' });
    } finally {
      setSaving(false);
    }
  }, [currentStudy, reviewer1, reviewer2, onSave, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Reviewers</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-secondary-foreground text-sm">
            Assign two reviewers to this study. Each reviewer will independently complete their
            assessments.
          </p>

          <div className="space-y-4">
            <div className="text-foreground flex items-center gap-2 text-sm font-medium">
              <UserIcon className="h-4 w-4" />
              <span>Reviewer Assignments</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-secondary-foreground mb-1 block text-sm font-medium">
                  Reviewer 1
                </label>
                <Select value={reviewer1} onValueChange={setReviewer1}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {memberItems
                      .filter(item => item.value !== reviewer2 || item.value === '_unassigned')
                      .map(item => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-secondary-foreground mb-1 block text-sm font-medium">
                  Reviewer 2
                </label>
                <Select value={reviewer2} onValueChange={setReviewer2}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {memberItems
                      .filter(item => item.value !== reviewer1 || item.value === '_unassigned')
                      .map(item => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {members.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No team members available. Add members to the project first.
              </p>
            )}
          </div>

          <div className="border-border flex justify-end gap-3 border-t pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="border-border bg-card text-secondary-foreground hover:bg-muted rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
