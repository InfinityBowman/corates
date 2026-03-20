/**
 * DevStateTree - Recursive tree view of project state
 *
 * Displays the current Y.Doc state in an expandable tree format.
 */

import { useState, useMemo } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';

interface TreeNodeProps {
  nodeKey: string | number;
  value: unknown;
  depth: number;
  defaultExpanded?: boolean;
}

function TreeNode({ nodeKey, value, depth, defaultExpanded = false }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;
  const isEmpty =
    isArray ? (value as unknown[]).length === 0
    : isObject ? Object.keys(value as object).length === 0
    : false;

  const childEntries = useMemo(() => {
    if (isArray) {
      return (value as unknown[]).map((v, i) => [i, v] as [number, unknown]);
    }
    if (isObject) {
      return Object.entries(value as object);
    }
    return [];
  }, [value, isArray, isObject]);

  const getValuePreview = (): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') {
      if (value.length > 50) return `"${value.slice(0, 50)}..."`;
      return `"${value}"`;
    }
    if (isArray) return `Array(${(value as unknown[]).length})`;
    if (isObject) return `Object(${Object.keys(value as object).length})`;
    return String(value);
  };

  const getValueClass = (): string => {
    if (value === null || value === undefined) return 'text-muted-foreground italic';
    if (typeof value === 'boolean') return 'text-purple-600';
    if (typeof value === 'number') return 'text-orange-600';
    if (typeof value === 'string') return 'text-green-600';
    return 'text-muted-foreground';
  };

  return (
    <div style={{ paddingLeft: `${depth * 16}px` }}>
      <div
        className='flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 hover:bg-muted'
        onClick={() => isExpandable && setIsExpanded(!isExpanded)}
      >
        {isExpandable && !isEmpty ?
          <span className='flex size-4 items-center justify-center text-muted-foreground'>
            {isExpanded ?
              <ChevronDownIcon size={12} />
            : <ChevronRightIcon size={12} />}
          </span>
        : <span className='size-4' />}

        <span className='text-cyan-600'>{nodeKey}:</span>
        <span className={`ml-1 ${getValueClass()}`}>{getValuePreview()}</span>
      </div>

      {isExpanded &&
        isExpandable &&
        childEntries.map(([key, val]) => (
          <TreeNode
            key={String(key)}
            nodeKey={key}
            value={val}
            depth={depth + 1}
            defaultExpanded={false}
          />
        ))}
    </div>
  );
}

interface DevStateTreeProps {
  data: {
    meta?: Record<string, unknown>;
    members?: unknown[];
    studies?: Array<{ checklists?: unknown[] }>;
  } | null;
}

export function DevStateTree({ data }: DevStateTreeProps) {
  const hasData = data && Object.keys(data).length > 0;

  const summary = useMemo(() => {
    if (!data) return null;
    return {
      studiesCount: data.studies?.length || 0,
      membersCount: data.members?.length || 0,
      checklistsCount:
        data.studies?.reduce((sum: number, s) => sum + (s.checklists?.length || 0), 0) || 0,
    };
  }, [data]);

  return (
    <div className='flex h-full flex-col'>
      {/* Summary bar */}
      {summary && (
        <div className='flex gap-4 border-b border-border bg-muted px-3 py-2'>
          <span className='text-xs text-muted-foreground'>
            <strong className='text-foreground'>{summary.studiesCount}</strong> studies
          </span>
          <span className='text-xs text-muted-foreground'>
            <strong className='text-foreground'>{summary.checklistsCount}</strong> checklists
          </span>
          <span className='text-xs text-muted-foreground'>
            <strong className='text-foreground'>{summary.membersCount}</strong> members
          </span>
        </div>
      )}

      {/* Tree */}
      {hasData ?
        <div className='overflow-auto py-2 font-mono text-[11px]'>
          <TreeNode nodeKey='meta' value={data.meta} depth={0} defaultExpanded={true} />
          <TreeNode nodeKey='members' value={data.members} depth={0} defaultExpanded={false} />
          <TreeNode nodeKey='studies' value={data.studies} depth={0} defaultExpanded={true} />
        </div>
      : <div className='p-6 text-center text-muted-foreground'>No data loaded</div>}
    </div>
  );
}
