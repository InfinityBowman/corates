/**
 * DevQuickActions - Common operations for dev workflow
 */

import { useState } from 'react';
import { Trash2Icon, RefreshCwIcon, CheckIcon, AlertCircleIcon } from 'lucide-react';
import { resetState } from '@/server/functions/dev-tools.functions';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ActionResult {
  success: boolean;
  message: string;
}

interface DevQuickActionsProps {
  projectId: string | null;
  orgId: string | null;
}

export function DevQuickActions({ projectId, orgId }: DevQuickActionsProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const resetProject = async () => {
    if (!projectId || !orgId) return;

    setIsResetting(true);
    setResult(null);

    try {
      await resetState({ data: { orgId, projectId } });
      setResult({ success: true, message: 'Project state cleared' });
    } catch (err) {
      console.error('[DevPanel] Reset error:', err);
      setResult({ success: false, message: (err as Error).message });
    } finally {
      setIsResetting(false);
    }
  };

  const forceRefresh = () => {
    window.location.reload();
  };

  return (
    <div className='border-border flex flex-col gap-3 border-t pt-3'>
      <h4 className='text-foreground text-xs font-semibold'>Quick Actions</h4>

      <div className='flex gap-2'>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant='destructive'
              size='sm'
              disabled={isResetting}
              title='Clear all project data'
            >
              {isResetting ?
                <Spinner size='sm' variant='white' />
              : <Trash2Icon />}
              Reset State
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className='z-10000'>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset project state?</AlertDialogTitle>
              <AlertDialogDescription>
                This will clear ALL project data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant='destructive' onClick={resetProject}>
                Reset State
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button variant='outline' size='sm' onClick={forceRefresh} title='Reload the page'>
          <RefreshCwIcon />
          Force Refresh
        </Button>
      </div>

      {result && (
        <Alert
          variant={result.success ? 'success' : 'destructive'}
          className='items-center gap-2 px-3 py-2'
        >
          {result.success ?
            <CheckIcon />
          : <AlertCircleIcon />}
          <AlertDescription className='text-xs'>{result.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
