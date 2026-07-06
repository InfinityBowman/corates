/**
 * DistributionChart - D3.js horizontal stacked bar chart showing the percentage
 * distribution of judgments across reviews/studies for each item in the chart
 * config (AMSTAR-2 questions, RoB 2 domains, ...).
 */

import { useState, useEffect, useRef, useImperativeHandle } from 'react';
// @ts-expect-error -- d3 has no type declarations in this project
import * as d3 from 'd3';
import { contrastColor, legendMarginRight } from './chartConfigs';
import type { ChartCategory, ChartPalette, ChecklistChartConfig } from './chartConfigs';

interface DistributionDataItem {
  label: string;
  values: string[];
}

interface ProcessedRow {
  label: string;
  key: string;
  counts: Record<string, number>;
  percentages: Record<string, number>;
}

interface DistributionChartProps {
  ref?: React.Ref<SVGSVGElement>;
  data: DistributionDataItem[];
  config: ChecklistChartConfig;
  width?: number;
  title?: string;
  palette?: ChartPalette;
}

const MARGIN = { top: 50, bottom: 60 };

// Fixed vertical space per row; chart height grows with content
// instead of tracking an aspect ratio of the container width.
const DEFAULT_ROW_HEIGHT = 28;

const LABEL_LINE_HEIGHT = 13;

/** Greedy word wrap sized to the configured left margin at ~6px per character */
function wrapLabel(label: string, marginLeft: number): string[] {
  const maxChars = Math.max(10, Math.floor((marginLeft - 20) / 6));
  const words = label.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function DistributionChart({
  data = [],
  config,
  width: widthProp,
  title = '',
  palette = 'default',
  ref,
}: DistributionChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(900);

  useImperativeHandle(ref, () => svgRef.current as SVGSVGElement, []);

  // ResizeObserver for responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const resize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        setContainerWidth(Math.max(rect.width, 400));
      }
    };

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) resize();
      }
    });

    resizeObserver.observe(el);
    resize();

    return () => resizeObserver.disconnect();
  }, []);

  const width = widthProp ?? containerWidth;
  const marginLeft = config.distributionMarginLeft ?? 80;
  const marginRight = legendMarginRight(config);
  const rowHeight = config.distributionRowHeight ?? DEFAULT_ROW_HEIGHT;
  const nRows = config.columns.length;
  const chartWidth = Math.max(0, width - marginLeft - marginRight);
  const chartHeight = nRows * rowHeight;
  const height = MARGIN.top + chartHeight + MARGIN.bottom;

  // D3 imperative draw
  useEffect(() => {
    if (!svgRef.current || !data.length || chartWidth <= 0 || chartHeight <= 0) return;

    const categoryMap = new Map<string, ChartCategory>(config.categories.map(c => [c.key, c]));
    const fillFor = (c: ChartCategory) => c.colors[palette];

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .style('background', '#ffffff')
      .style('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');

    svg.selectAll('*').remove();

    // Process data to calculate percentages
    const totalStudies = data.length;
    const processedData: ProcessedRow[] = config.columns.map((column, colIdx) => {
      const row: ProcessedRow = {
        key: column.id,
        label: column.distributionLabel ?? column.label,
        counts: Object.fromEntries(config.categories.map(c => [c.key, 0])),
        percentages: {},
      };
      data.forEach(study => {
        const value = study.values[colIdx]?.toLowerCase?.() ?? '';
        const key = categoryMap.has(value) ? value : config.fallbackCategory;
        if (Object.hasOwn(row.counts, key)) row.counts[key]++;
      });
      Object.keys(row.counts).forEach(key => {
        row.percentages[key] = (row.counts[key] / totalStudies) * 100;
      });
      return row;
    });

    const yScale = d3
      .scaleBand()
      .domain(processedData.map(d => d.key))
      .range([0, chartHeight])
      .padding(0.1);
    const xScale = d3.scaleLinear().domain([0, 100]).range([0, chartWidth]);

    const chartGroup = svg.append('g').attr('transform', `translate(${marginLeft}, ${MARGIN.top})`);

    // Title
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .attr('font-weight', '600')
      .attr('fill', '#111827')
      .text(title);

    // Stacked bars
    processedData.forEach(d => {
      let cumPercent = 0;
      const barHeight = Math.max(0, yScale.bandwidth());
      const y = yScale(d.key);

      config.stackOrder.forEach(categoryKey => {
        const category = categoryMap.get(categoryKey);
        if (!category) return;
        const percent = d.percentages[categoryKey] ?? 0;
        const segWidth = Math.max(0, xScale(percent));

        if (percent > 0 && segWidth > 0 && barHeight > 0) {
          const fill = fillFor(category);
          chartGroup
            .append('rect')
            .attr('x', xScale(cumPercent))
            .attr('y', y)
            .attr('width', segWidth)
            .attr('height', barHeight)
            .attr('fill', fill)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1);

          if (percent >= 5) {
            chartGroup
              .append('text')
              .attr('x', xScale(cumPercent) + segWidth / 2)
              .attr('y', (y ?? 0) + barHeight / 2)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .attr('font-size', '12px')
              .attr('font-weight', '600')
              .attr('fill', contrastColor(fill))
              .text(`${percent.toFixed(1)}`);
          }
        }
        cumPercent += percent;
      });
    });

    // Y-axis labels (wrapped to fit the configured margin)
    processedData.forEach(d => {
      const lines = wrapLabel(d.label, marginLeft);
      const yCenter = (yScale(d.key) ?? 0) + yScale.bandwidth() / 2;
      const yStart = yCenter - ((lines.length - 1) * LABEL_LINE_HEIGHT) / 2;
      lines.forEach((line, i) => {
        chartGroup
          .append('text')
          .attr('x', -10)
          .attr('y', yStart + i * LABEL_LINE_HEIGHT)
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', lines.length > 1 ? '11px' : '13px')
          .attr('font-weight', '500')
          .attr('fill', '#374151')
          .text(line);
      });
    });

    // X-axis
    const xAxis = d3
      .axisBottom(xScale)
      .tickFormat((d: number) => `${d}`)
      .ticks(5);
    chartGroup
      .append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('font-size', '12px')
      .attr('fill', '#374151');

    // X-axis label
    chartGroup
      .append('text')
      .attr('x', chartWidth / 2)
      .attr('y', chartHeight + 50)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', '500')
      .attr('fill', '#374151')
      .text(config.distributionXAxisLabel(totalStudies));

    // Y-axis label
    if (config.distributionYAxisLabel) {
      svg
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('font-weight', '500')
        .attr('fill', '#374151')
        .text(config.distributionYAxisLabel);
    }

    // Legend - only categories present in the data (robvis drop=TRUE behavior)
    const presentKeys = new Set<string>();
    processedData.forEach(d => {
      Object.keys(d.counts).forEach(key => {
        if (d.counts[key] > 0) presentKeys.add(key);
      });
    });
    const legendData = config.categories.filter(c => presentKeys.has(c.key));
    const legend = svg
      .append('g')
      .attr('transform', `translate(${width - marginRight + 20}, ${MARGIN.top + 20})`);
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
    items
      .append('text')
      .attr('x', 24)
      .attr('dy', '0.35em')
      .attr('font-size', '13px')
      .attr('font-weight', '500')
      .attr('fill', '#374151')
      .text((d: ChartCategory) => d.label);

    return () => {
      svg.selectAll('*').remove();
    };
  }, [
    data,
    config,
    palette,
    width,
    height,
    chartWidth,
    chartHeight,
    marginLeft,
    marginRight,
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
        style={{ width: '100%', maxWidth: '100%', display: 'block', height: `${height}px` }}
      />
    </div>
  );
}
