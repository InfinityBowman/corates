/**
 * DevStateTree - Recursive tree view of project state
 *
 * Displays the current Y.Doc state in an expandable tree format.
 */

import { createSignal, For, Show, createMemo } from 'solid-js';
import { FiChevronRight, FiChevronDown } from 'solid-icons/fi';

function TreeNode(props) {
  const [isExpanded, setIsExpanded] = createSignal(props.defaultExpanded ?? false);

  const isObject = () =>
    props.value !== null && typeof props.value === 'object' && !Array.isArray(props.value);
  const isArray = () => Array.isArray(props.value);
  const isExpandable = () => isObject() || isArray();
  const isEmpty = () => {
    if (isArray()) return props.value.length === 0;
    if (isObject()) return Object.keys(props.value).length === 0;
    return false;
  };

  const childEntries = createMemo(() => {
    if (isArray()) {
      return props.value.map((v, i) => [i, v]);
    }
    if (isObject()) {
      return Object.entries(props.value);
    }
    return [];
  });

  const getValuePreview = () => {
    if (props.value === null) return 'null';
    if (props.value === undefined) return 'undefined';
    if (typeof props.value === 'boolean') return props.value.toString();
    if (typeof props.value === 'number') return props.value.toString();
    if (typeof props.value === 'string') {
      if (props.value.length > 50) return `"${props.value.slice(0, 50)}..."`;
      return `"${props.value}"`;
    }
    if (isArray()) return `Array(${props.value.length})`;
    if (isObject()) return `Object(${Object.keys(props.value).length})`;
    return String(props.value);
  };

  const getValueClass = () => {
    if (props.value === null || props.value === undefined) return 'text-gray-400 italic';
    if (typeof props.value === 'boolean') return 'text-purple-600';
    if (typeof props.value === 'number') return 'text-orange-600';
    if (typeof props.value === 'string') return 'text-green-600';
    return 'text-gray-500';
  };

  return (
    <div style={{ 'padding-left': `${props.depth * 16}px` }}>
      <div
        class='flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 hover:bg-gray-100'
        onClick={() => isExpandable() && setIsExpanded(!isExpanded())}
      >
        <Show when={isExpandable() && !isEmpty()}>
          <span class='flex h-4 w-4 items-center justify-center text-gray-400'>
            <Show when={isExpanded()} fallback={<FiChevronRight size={12} />}>
              <FiChevronDown size={12} />
            </Show>
          </span>
        </Show>
        <Show when={!isExpandable() || isEmpty()}>
          <span class='h-4 w-4' />
        </Show>

        <span class='text-cyan-600'>{props.nodeKey}:</span>
        <span class={`ml-1 ${getValueClass()}`}>{getValuePreview()}</span>
      </div>

      <Show when={isExpanded() && isExpandable()}>
        <For each={childEntries()}>
          {([key, value]) => (
            <TreeNode nodeKey={key} value={value} depth={props.depth + 1} defaultExpanded={false} />
          )}
        </For>
      </Show>
    </div>
  );
}

export default function DevStateTree(props) {
  const hasData = () => props.data && Object.keys(props.data).length > 0;

  const summary = createMemo(() => {
    if (!props.data) return null;
    return {
      studiesCount: props.data.studies?.length || 0,
      membersCount: props.data.members?.length || 0,
      checklistsCount:
        props.data.studies?.reduce((sum, s) => sum + (s.checklists?.length || 0), 0) || 0,
    };
  });

  return (
    <div class='flex h-full flex-col'>
      {/* Summary bar */}
      <Show when={summary()}>
        <div class='flex gap-4 border-b border-gray-200 bg-gray-50 px-3 py-2'>
          <span class='text-xs text-gray-500'>
            <strong class='text-gray-700'>{summary().studiesCount}</strong> studies
          </span>
          <span class='text-xs text-gray-500'>
            <strong class='text-gray-700'>{summary().checklistsCount}</strong> checklists
          </span>
          <span class='text-xs text-gray-500'>
            <strong class='text-gray-700'>{summary().membersCount}</strong> members
          </span>
        </div>
      </Show>

      {/* Tree */}
      <Show
        when={hasData()}
        fallback={<div class='p-6 text-center text-gray-400'>No data loaded</div>}
      >
        <div class='overflow-auto py-2 font-mono text-[11px]'>
          <TreeNode nodeKey='meta' value={props.data.meta} depth={0} defaultExpanded={true} />
          <TreeNode
            nodeKey='members'
            value={props.data.members}
            depth={0}
            defaultExpanded={false}
          />
          <TreeNode nodeKey='studies' value={props.data.studies} depth={0} defaultExpanded={true} />
        </div>
      </Show>
    </div>
  );
}
