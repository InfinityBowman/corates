import { useId } from 'react';
import type { DomainMapping, DomainMappingNode } from '@/lib/comparison-content';

const WIDTH = 640;
const COLUMN_WIDTH = 240;
const BOX_HEIGHT = 46;
const ROW_HEIGHT = 60;
const HEADER_HEIGHT = 30;
const RIGHT_X = WIDTH - COLUMN_WIDTH;

const NO_EQUIVALENT_LABEL = 'No equivalent';

/**
 * Two columns of domain boxes joined by curves. The right column is spread
 * over the same height as the left so the figure reads top to bottom on both
 * sides regardless of how many domains each version has.
 */
export function DomainMappingFigure({ mapping }: { mapping: DomainMapping }) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  const hasDropped = mapping.edges.some(edge => edge.to === null);
  const rightCount = mapping.right.length + (hasDropped ? 1 : 0);
  const columnHeight = (mapping.left.length - 1) * ROW_HEIGHT;
  const rightStep = rightCount > 1 ? columnHeight / (rightCount - 1) : 0;
  const height = HEADER_HEIGHT + columnHeight + BOX_HEIGHT;

  const leftY = (index: number) => HEADER_HEIGHT + index * ROW_HEIGHT;
  const rightY = (index: number) => HEADER_HEIGHT + index * rightStep;
  const droppedIndex = mapping.right.length;

  const leftText = (node: DomainMappingNode) =>
    node.sub ? `${node.label} (${node.sub})` : node.label;
  const rightText = (node: DomainMappingNode) =>
    node.sub ? `${node.label}, ${node.sub}` : node.label;
  const edgeVerb = (edge: DomainMapping['edges'][number]) =>
    edge.to === null ? ' has '
    : edge.dashed ? ' in part becomes '
    : ' becomes ';

  return (
    <div className='mb-6 rounded-lg border border-gray-200 bg-white p-4'>
      {/* The two-column drawing needs about 520px; on a phone a list of the
          same mappings reads better than a scaled-down or scrolling SVG */}
      <ul
        className='flex flex-col gap-2 text-sm sm:hidden'
        aria-label={`${mapping.leftTitle} to ${mapping.rightTitle}`}
      >
        {mapping.edges.map(edge => (
          <li key={`${edge.from}-${edge.to}`}>
            <span className='font-semibold text-gray-900'>{leftText(mapping.left[edge.from])}</span>
            <span className='text-gray-500'>{edgeVerb(edge)}</span>
            <span className='text-blue-800'>
              {edge.to === null ? 'no equivalent' : rightText(mapping.right[edge.to])}
            </span>
          </li>
        ))}
      </ul>
      <div className='hidden sm:block'>
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          className='h-auto w-full'
          role='img'
          aria-labelledby={`${titleId} ${descId}`}
        >
          <title
            id={titleId}
          >{`${mapping.leftTitle} to ${mapping.rightTitle} domain mapping`}</title>
          <desc id={descId}>{mapping.description}</desc>

          <text
            x={COLUMN_WIDTH / 2}
            y={16}
            textAnchor='middle'
            className='fill-gray-700'
            fontSize={13}
            fontWeight={600}
          >
            {mapping.leftTitle}
          </text>
          <text
            x={RIGHT_X + COLUMN_WIDTH / 2}
            y={16}
            textAnchor='middle'
            className='fill-gray-700'
            fontSize={13}
            fontWeight={600}
          >
            {mapping.rightTitle}
          </text>

          {mapping.edges.map(edge => {
            const y1 = leftY(edge.from) + BOX_HEIGHT / 2;
            const targetIndex = edge.to === null ? droppedIndex : edge.to;
            const y2 = rightY(targetIndex) + BOX_HEIGHT / 2;
            const x1 = COLUMN_WIDTH;
            const x2 = RIGHT_X;
            const midX = (x1 + x2) / 2;
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                fill='none'
                className='stroke-gray-400'
                strokeWidth={1.5}
                strokeDasharray={edge.dashed ? '4 4' : undefined}
              />
            );
          })}

          {mapping.left.map((node, index) => (
            <DomainBox key={node.label + node.sub} x={0} y={leftY(index)} node={node} side='left' />
          ))}
          {mapping.right.map((node, index) => (
            <DomainBox
              key={node.label + node.sub}
              x={RIGHT_X}
              y={rightY(index)}
              node={node}
              side='right'
            />
          ))}
          {hasDropped && (
            <DomainBox
              x={RIGHT_X}
              y={rightY(droppedIndex)}
              node={{ label: NO_EQUIVALENT_LABEL }}
              side='dropped'
            />
          )}
        </svg>
      </div>
      <p className='mt-3 text-sm text-gray-500'>{mapping.caption}</p>
    </div>
  );
}

function DomainBox({
  x,
  y,
  node,
  side,
}: {
  x: number;
  y: number;
  node: { label: string; sub?: string };
  side: 'left' | 'right' | 'dropped';
}) {
  const boxClass =
    side === 'right' ? 'fill-blue-50 stroke-blue-200'
    : side === 'left' ? 'fill-gray-50 stroke-gray-300'
    : 'fill-white stroke-gray-300';
  const labelY = node.sub ? y + 20 : y + BOX_HEIGHT / 2 + 4.5;
  return (
    <g>
      <rect
        x={x + 0.75}
        y={y + 0.75}
        width={COLUMN_WIDTH - 1.5}
        height={BOX_HEIGHT - 1.5}
        rx={6}
        className={boxClass}
        strokeWidth={1.5}
        strokeDasharray={side === 'dropped' ? '4 4' : undefined}
      />
      <text
        x={x + 12}
        y={labelY}
        fontSize={13}
        fontWeight={600}
        className={side === 'right' ? 'fill-blue-800' : 'fill-gray-900'}
      >
        {node.label}
      </text>
      {node.sub && (
        <text x={x + 12} y={y + 36} fontSize={11.5} className='fill-gray-600'>
          {node.sub}
        </text>
      )}
    </g>
  );
}
