import type { DecisionNode } from '@/lib/comparison-content';

/**
 * Vertical decision tree built from ordinary elements rather than SVG so the
 * text stays at body size on a phone and the branches simply stack. The spine
 * is the list's left border and each branch draws its own stub with a
 * pseudo-element.
 */
function DecisionNodeView({ node }: { node: DecisionNode }) {
  if (node.kind === 'result') {
    const isTool = node.tone === 'tool';
    return (
      <div
        className={`rounded-md border px-4 py-3 ${
          isTool ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'
        }`}
      >
        <p className={`font-semibold ${isTool ? 'text-blue-800' : 'text-gray-900'}`}>{node.tool}</p>
        <p className='mt-0.5 text-sm text-gray-600'>{node.detail}</p>
      </div>
    );
  }

  return (
    <div>
      <p className='rounded-md border border-gray-300 bg-white px-4 py-3 font-medium text-gray-900'>
        {node.text}
      </p>
      <ul className='mt-3 ml-4 flex flex-col gap-3 border-l-2 border-gray-300 pl-4 sm:ml-6 sm:pl-6'>
        {node.branches.map(branch => (
          <li
            key={branch.label}
            className='relative before:absolute before:top-3 before:-left-4 before:w-4 before:border-t-2 before:border-gray-300 sm:before:-left-6 sm:before:w-6'
          >
            <span className='mb-2 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-gray-700 uppercase'>
              {branch.label}
            </span>
            <DecisionNodeView node={branch.node} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DecisionTree({ root }: { root: DecisionNode }) {
  return (
    <div className='mb-6 rounded-lg border border-gray-200 bg-white p-4 sm:p-6'>
      <DecisionNodeView node={root} />
    </div>
  );
}
