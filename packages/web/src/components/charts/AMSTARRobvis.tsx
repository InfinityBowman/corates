/**
 * AMSTARRobvis - D3.js traffic light heatmap showing AMSTAR-2 item-level judgments by review.
 * Each row is a review, each column is one of the 16 AMSTAR-2 questions.
 * Uses useLayoutEffect for text measurement to avoid flash of incorrect margins.
 */

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useImperativeHandle } from 'react';
// @ts-expect-error -- d3 has no type declarations in this project
import * as d3 from 'd3';

interface RobvisDataItem {
  label: string;
  questions: string[];
}

interface LegendItem {
  key: string;
  label: string;
}

interface AMSTARRobvisProps {
  ref?: React.Ref<SVGSVGElement>;
  data: RobvisDataItem[];
  width?: number;
  title?: string;
  greyscale?: boolean;
}

const COLOR_MAP_DEFAULT: Record<string, string> = {
  yes: '#10b981',
  'partial yes': '#facc15',
  no: '#ef4444',
  'no ma': '#9ca3af',
};

const COLOR_MAP_GREYSCALE: Record<string, string> = {
  yes: '#1b1b1b',
  'partial yes': '#484848',
  no: '#727272',
  'no ma': '#a2a2a2',
};

const N_QUESTIONS = 16;

// Cap cell size so the heatmap stays compact on wide screens; width-driven
// sizing alone made cells balloon to ~70px when only a few reviews existed.
const MAX_CELL_SIZE = 32;

export function AMSTARRobvis({
  data = [],
  width: widthProp,
  title = 'AMSTAR 2 Item-Level Judgments by Review',
  greyscale = false,
  ref,
}: AMSTARRobvisProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [dynamicMarginLeft, setDynamicMarginLeft] = useState(200);

  // Expose SVG ref to parent for export

  useImperativeHandle(ref, () => svgRef.current as SVGSVGElement, []);

  // ResizeObserver for responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        setContainerWidth(Math.max(rect.width, 600));
      }
    };

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) updateSize();
      }
    });

    resizeObserver.observe(el);
    updateSize();

    return () => resizeObserver.disconnect();
  }, []);

  const colors = greyscale ? COLOR_MAP_GREYSCALE : COLOR_MAP_DEFAULT;
  const width = widthProp ?? containerWidth;

  const margin = useMemo(
    () => ({
      top: 60,
      right: 170,
      bottom: data.length <= 1 ? 80 : 60,
      left: dynamicMarginLeft,
    }),
    [data.length, dynamicMarginLeft],
  );

  const cellSizeX = Math.max(0, (width - margin.left - margin.right) / N_QUESTIONS);
  const cellSize = Math.min(cellSizeX, MAX_CELL_SIZE);
  const chartWidth = Math.max(0, cellSize * N_QUESTIONS);
  const chartHeight = Math.max(0, cellSize * Math.max(data.length, 1));
  const svgWidth = Math.max(0, margin.left + chartWidth + margin.right);
  const svgHeight = Math.max(0, margin.top + chartHeight + margin.bottom);

  // Measure label text widths synchronously before paint to avoid margin flash
  useLayoutEffect(() => {
    if (!svgRef.current || !data.length) return;

    const tempSvg = d3
      .select(document.body)
      .append('svg')
      .style('visibility', 'hidden')
      .style('position', 'absolute');

    let maxLabelWidth = 0;
    data.forEach(row => {
      const tempText = tempSvg
        .append('text')
        .attr('font-size', '12px')
        .attr('font-weight', '500')
        .text(row.label);
      const bbox = tempText.node()!.getBBox();
      if (bbox.width > maxLabelWidth) maxLabelWidth = bbox.width;
      tempText.remove();
    });
    tempSvg.remove();

    setDynamicMarginLeft(Math.max(150, Math.ceil(maxLabelWidth + 20)));
  }, [data]);

  // D3 imperative draw
  useEffect(() => {
    if (!svgRef.current || !data.length || cellSize <= 0 || svgWidth <= 0 || svgHeight <= 0) return;

    const svg = d3
      .select(svgRef.current)
      .attr('width', svgWidth)
      .attr('height', svgHeight)
      .style('background', '#ffffff')
      .style('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');

    svg.selectAll('*').remove();

    const m = margin;

    // Column headers
    svg
      .append('g')
      .selectAll('text')
      .data(d3.range(1, N_QUESTIONS + 1))
      .enter()
      .append('text')
      .attr('x', (_d: number, i: number) => m.left + i * cellSize + cellSize / 2)
      .attr('y', m.top + chartHeight + 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#374151')
      .text((d: number) => `Q${d}`);

    // Row labels
    svg
      .append('g')
      .selectAll('text')
      .data(data)
      .enter()
      .append('text')
      .attr('x', m.left - 10)
      .attr('y', (_: RobvisDataItem, i: number) => m.top + i * cellSize + cellSize / 2)
      .attr('text-anchor', 'end')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('fill', '#374151')
      .attr('dominant-baseline', 'middle')
      .text((d: RobvisDataItem) => d.label);

    // Traffic light cells
    const cellGroup = svg.append('g');
    data.forEach((row, rowIdx) => {
      for (let colIdx = 0; colIdx < N_QUESTIONS; colIdx++) {
        const value = row.questions[colIdx]?.toLowerCase?.() ?? '';
        const cellColor = colors[value] ?? '#e5e7eb';
        const cw = Math.max(0, cellSize - 4);
        if (cw > 0) {
          cellGroup
            .append('rect')
            .attr('x', m.left + colIdx * cellSize + 2)
            .attr('y', m.top + rowIdx * cellSize + 2)
            .attr('width', cw)
            .attr('height', cw)
            .attr('fill', cellColor)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .attr('rx', Math.max(2, cellSize * 0.12))
            .style('filter', 'drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.1))');
        }
      }
    });

    // Legend
    const legendData = [
      { key: 'yes', label: 'Yes' },
      { key: 'partial yes', label: 'Partial Yes' },
      { key: 'no', label: 'No' },
      { key: 'no ma', label: 'No MA' },
    ];
    const legend = svg
      .append('g')
      .attr('transform', `translate(${svgWidth - m.right + 20}, ${m.top + 20})`);
    const items = legend
      .selectAll('.legend-item')
      .data(legendData)
      .enter()
      .append('g')
      .attr('transform', (_d: LegendItem, i: number) => `translate(0, ${i * 25})`);
    items
      .append('rect')
      .attr('y', -8)
      .attr('width', 16)
      .attr('height', 16)
      .attr('rx', 2)
      .attr('fill', (d: LegendItem) => colors[d.key])
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1);
    items
      .append('text')
      .attr('x', 24)
      .attr('dy', '0.35em')
      .attr('font-size', '13px')
      .attr('font-weight', '500')
      .attr('fill', '#374151')
      .text((d: LegendItem) => d.label);

    // Title
    svg
      .append('text')
      .attr('x', svgWidth / 2)
      .attr('y', 40)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', '600')
      .attr('fill', '#111827')
      .text(title);

    return () => {
      svg.selectAll('*').remove();
    };
  }, [data, colors, cellSize, svgWidth, svgHeight, chartWidth, chartHeight, margin, title]);

  return (
    <div
      ref={containerRef}
      style={{
        background: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        padding: '16px',
        margin: '16px auto',
        maxWidth: '880px',
        width: '100%',
      }}
    >
      <svg
        ref={svgRef}
        style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: `${svgHeight}px` }}
      />
    </div>
  );
}
