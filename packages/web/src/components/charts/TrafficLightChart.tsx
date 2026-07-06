/**
 * TrafficLightChart - D3.js traffic light heatmap showing per-item judgments by review/study.
 * Each row is one finalized checklist, each column comes from the chart config
 * (AMSTAR-2 questions, RoB 2 domains, ...). Follows robvis conventions: rounded
 * cells in the Cochrane palette with black print symbols.
 * Uses useLayoutEffect for text measurement to avoid flash of incorrect margins.
 */

import { useState, useEffect, useLayoutEffect, useMemo, useRef, useImperativeHandle } from 'react';
// @ts-expect-error -- d3 has no type declarations in this project
import * as d3 from 'd3';
import { contrastColor, legendMarginRight } from './chartConfigs';
import type { ChartCategory, ChartPalette, ChecklistChartConfig } from './chartConfigs';

interface TrafficLightDataItem {
  label: string;
  values: string[];
}

interface TrafficLightChartProps {
  ref?: React.Ref<SVGSVGElement>;
  data: TrafficLightDataItem[];
  config: ChecklistChartConfig;
  width?: number;
  title?: string;
  palette?: ChartPalette;
}

// Cap cell size so the heatmap stays compact on wide screens; width-driven
// sizing alone made cells balloon to ~70px when only a few reviews existed.
const MAX_CELL_SIZE = 32;

const CAPTION_LINE_HEIGHT = 15;

export function TrafficLightChart({
  data = [],
  config,
  width: widthProp,
  title = '',
  palette = 'default',
  ref,
}: TrafficLightChartProps) {
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

  const width = widthProp ?? containerWidth;
  const nColumns = config.columns.length;
  const nCaptionLines = config.caption?.length ?? 0;

  const margin = useMemo(
    () => ({
      top: 60,
      right: Math.max(170, legendMarginRight(config)),
      bottom:
        (data.length <= 1 ? 80 : 60) +
        (nCaptionLines ? nCaptionLines * CAPTION_LINE_HEIGHT + 10 : 0),
      left: dynamicMarginLeft,
    }),
    [data.length, dynamicMarginLeft, nCaptionLines, config],
  );

  const cellSizeX = Math.max(0, (width - margin.left - margin.right) / nColumns);
  const cellSize = Math.min(cellSizeX, MAX_CELL_SIZE);
  const chartWidth = Math.max(0, cellSize * nColumns);
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

    const categoryMap = new Map<string, ChartCategory>(config.categories.map(c => [c.key, c]));
    const fillFor = (c: ChartCategory) => c.colors[palette];
    const symbolColorFor = (c: ChartCategory) => contrastColor(fillFor(c));

    // Draw a lucide icon (24x24 viewBox path data) centered in a size*size box
    const drawIcon = (
      parent: d3.Selection,
      category: ChartCategory,
      x: number,
      y: number,
      size: number,
    ) => {
      if (!category.iconPaths.length) return;
      const iconGroup = parent
        .append('g')
        .attr('transform', `translate(${x}, ${y}) scale(${size / 24})`);
      for (const d of category.iconPaths) {
        iconGroup
          .append('path')
          .attr('d', d)
          .attr('fill', 'none')
          .attr('stroke', symbolColorFor(category))
          .attr('stroke-width', 2.5)
          .attr('stroke-linecap', 'round')
          .attr('stroke-linejoin', 'round');
      }
    };

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
      .data(config.columns)
      .enter()
      .append('text')
      .attr('x', (_d: unknown, i: number) => m.left + i * cellSize + cellSize / 2)
      .attr('y', m.top + chartHeight + 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#374151')
      .text((d: { label: string }) => d.label);

    // Row labels
    svg
      .append('g')
      .selectAll('text')
      .data(data)
      .enter()
      .append('text')
      .attr('x', m.left - 10)
      .attr('y', (_: TrafficLightDataItem, i: number) => m.top + i * cellSize + cellSize / 2)
      .attr('text-anchor', 'end')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('fill', '#374151')
      .attr('dominant-baseline', 'middle')
      .text((d: TrafficLightDataItem) => d.label);

    // Traffic light cells
    const cellGroup = svg.append('g');
    data.forEach((row, rowIdx) => {
      for (let colIdx = 0; colIdx < nColumns; colIdx++) {
        const value = row.values[colIdx]?.toLowerCase?.() ?? '';
        const category = categoryMap.get(value) ?? categoryMap.get(config.fallbackCategory);
        if (!category) continue;
        const cw = Math.max(0, cellSize - 4);
        if (cw > 0) {
          const x = m.left + colIdx * cellSize + 2;
          const y = m.top + rowIdx * cellSize + 2;
          cellGroup
            .append('rect')
            .attr('x', x)
            .attr('y', y)
            .attr('width', cw)
            .attr('height', cw)
            .attr('fill', fillFor(category))
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .attr('rx', Math.max(2, cellSize * 0.12))
            .style('filter', 'drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.1))');
          const iconSize = cw * 0.7;
          drawIcon(cellGroup, category, x + (cw - iconSize) / 2, y + (cw - iconSize) / 2, iconSize);
        }
      }
    });

    // Legend - only categories present in the data (robvis drop=TRUE behavior)
    const presentKeys = new Set<string>();
    data.forEach(row => {
      for (let colIdx = 0; colIdx < nColumns; colIdx++) {
        const value = row.values[colIdx]?.toLowerCase?.() ?? '';
        presentKeys.add(categoryMap.has(value) ? value : config.fallbackCategory);
      }
    });
    const legendData = config.categories.filter(c => presentKeys.has(c.key));
    const legend = svg
      .append('g')
      .attr('transform', `translate(${svgWidth - m.right + 20}, ${m.top + 20})`);
    const items = legend
      .selectAll('.legend-item')
      .data(legendData)
      .enter()
      .append('g')
      .attr('transform', (_d: ChartCategory, i: number) => `translate(0, ${i * 25})`);
    items
      .append('rect')
      .attr('y', -8)
      .attr('width', 16)
      .attr('height', 16)
      .attr('rx', 2)
      .attr('fill', (d: ChartCategory) => fillFor(d))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1);
    items.each(function (this: SVGGElement, d: ChartCategory) {
      drawIcon(d3.select(this), d, 2, -6, 12);
    });
    items
      .append('text')
      .attr('x', 24)
      .attr('dy', '0.35em')
      .attr('font-size', '13px')
      .attr('font-weight', '500')
      .attr('fill', '#374151')
      .text((d: ChartCategory) => d.label);

    // Caption / domain key below the column headers
    const captionLines = config.caption ?? [];
    if (captionLines.length) {
      const captionGroup = svg.append('g');
      captionLines.forEach((line, i) => {
        captionGroup
          .append('text')
          .attr('x', m.left)
          .attr('y', m.top + chartHeight + 45 + i * CAPTION_LINE_HEIGHT)
          .attr('font-size', '11px')
          .attr('fill', '#6b7280')
          .text(line);
      });
    }

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
  }, [
    data,
    config,
    palette,
    nColumns,
    cellSize,
    svgWidth,
    svgHeight,
    chartWidth,
    chartHeight,
    margin,
    title,
  ]);

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
