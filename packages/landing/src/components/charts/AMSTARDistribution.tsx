/**
 * AMSTARDistribution - D3.js horizontal stacked bar chart showing the percentage distribution
 * of AMSTAR-2 ratings across reviews for each of the 16 questions.
 */

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
// @ts-expect-error -- d3 has no type declarations in this project
import * as d3 from 'd3';

interface DistributionDataItem {
  label: string;
  questions: string[];
}

interface AMSTARDistributionProps {
  data: DistributionDataItem[];
  width?: number;
  height?: number;
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

const MARGIN = { top: 50, right: 150, bottom: 60, left: 80 };

// eslint-disable-next-line no-undef
export const AMSTARDistribution = forwardRef<SVGSVGElement, AMSTARDistributionProps>(
  function AMSTARDistribution(
    {
      data = [],
      width: widthProp,
      height: heightProp,
      title = 'Level Judgments Across Included Reviews',
      greyscale = false,
    },
    ref,
  ) {
    const svgRef = useRef<SVGSVGElement>(null); // eslint-disable-line no-undef
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 900, height: 600 });

    // eslint-disable-next-line no-undef
    useImperativeHandle(ref, () => svgRef.current as SVGSVGElement, []);

    // ResizeObserver for responsive sizing
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const resize = () => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({
            width: Math.max(rect.width, 400),
            height: Math.max(rect.height, 400),
          });
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

    const colors = greyscale ? COLOR_MAP_GREYSCALE : COLOR_MAP_DEFAULT;
    const width = widthProp ?? containerSize.width;
    const height = heightProp ?? containerSize.width / 1.5;
    const chartWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
    const chartHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);
    const titleFont = Math.max(Math.round(width / 50), 12) + 1;

    // D3 imperative draw
    useEffect(() => {
      if (!svgRef.current || !data.length || chartWidth <= 0 || chartHeight <= 0) return;

      const svg = d3
        .select(svgRef.current)
        .attr('width', width)
        .attr('height', height)
        .style('background', '#ffffff')
        .style('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');

      svg.selectAll('*').remove();

      // Process data to calculate percentages
      const nQuestions = Math.max(...data.map(d => d.questions?.length || 0));
      const totalStudies = data.length;
      const processedData: any[] = [];

      for (let q = 0; q < nQuestions; q++) {
        const qData: any = {
          question: q + 1,
          label: `Q${q + 1}`,
          counts: { yes: 0, 'partial yes': 0, no: 0, 'no ma': 0 },
          percentages: {} as any,
        };
        data.forEach(study => {
          const response = study.questions[q]?.toLowerCase?.() ?? 'no ma';
          if (Object.hasOwn(qData.counts, response)) qData.counts[response]++;
        });
        Object.keys(qData.counts).forEach(key => {
          qData.percentages[key] = (qData.counts[key] / totalStudies) * 100;
        });
        processedData.push(qData);
      }

      const yScale = d3
        .scaleBand()
        .domain(processedData.map(d => d.label))
        .range([0, chartHeight])
        .padding(0.1);
      const xScale = d3.scaleLinear().domain([0, 100]).range([0, chartWidth]);

      const chartGroup = svg
        .append('g')
        .attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`);

      // Title
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', 30)
        .attr('text-anchor', 'middle')
        .attr('font-size', titleFont + 'px')
        .attr('font-weight', '600')
        .attr('fill', '#111827')
        .text(title);

      // Stacked bars
      processedData.forEach(d => {
        let cumPercent = 0;
        const barHeight = Math.max(0, yScale.bandwidth());
        const y = yScale(d.label);

        ['yes', 'partial yes', 'no ma', 'no'].forEach(category => {
          const percent = d.percentages[category];
          const segWidth = Math.max(0, xScale(percent));

          if (percent > 0 && segWidth > 0 && barHeight > 0) {
            chartGroup
              .append('rect')
              .attr('x', xScale(cumPercent))
              .attr('y', y)
              .attr('width', segWidth)
              .attr('height', barHeight)
              .attr('fill', colors[category])
              .attr('stroke', '#ffffff')
              .attr('stroke-width', 1);

            if (percent >= 5) {
              const isLightBg =
                greyscale ? category === 'no' || category === 'no ma' : category === 'partial yes';
              chartGroup
                .append('text')
                .attr('x', xScale(cumPercent) + segWidth / 2)
                .attr('y', (y ?? 0) + barHeight / 2)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('font-size', '12px')
                .attr('font-weight', '600')
                .attr('fill', isLightBg ? '#000000' : '#ffffff')
                .text(`${percent.toFixed(1)}`);
            }
          }
          cumPercent += percent;
        });
      });

      // Y-axis labels
      chartGroup
        .selectAll('.y-label')
        .data(processedData)
        .enter()
        .append('text')
        .attr('x', -10)
        .attr('y', (d: any) => (yScale(d.label) ?? 0) + yScale.bandwidth() / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '13px')
        .attr('font-weight', '500')
        .attr('fill', '#374151')
        .text((d: any) => d.label);

      // X-axis
      const xAxis = d3
        .axisBottom(xScale)
        .tickFormat((d: any) => `${d}`)
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
        .text(`Percentage of SRs (%), N=${totalStudies}`);

      // Y-axis label
      svg
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('font-weight', '500')
        .attr('fill', '#374151')
        .text('Items of AMSTAR-2');

      // Legend
      const legendData = [
        { key: 'yes', label: 'Yes' },
        { key: 'partial yes', label: 'Partial Yes' },
        { key: 'no', label: 'No' },
        { key: 'no ma', label: 'No MA' },
      ];
      const legend = svg
        .append('g')
        .attr('transform', `translate(${width - MARGIN.right + 20}, ${MARGIN.top + 20})`);
      const items = legend
        .selectAll('.legend-item')
        .data(legendData)
        .enter()
        .append('g')
        .attr('transform', (_d: any, i: number) => `translate(0, ${i * 25})`);
      items
        .append('rect')
        .attr('y', -8)
        .attr('width', 16)
        .attr('height', 16)
        .attr('rx', 2)
        .attr('fill', (d: any) => colors[d.key])
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1);
      items
        .append('text')
        .attr('x', 24)
        .attr('dy', '0.35em')
        .attr('font-size', '13px')
        .attr('font-weight', '500')
        .attr('fill', '#374151')
        .text((d: any) => d.label);

      return () => {
        svg.selectAll('*').remove();
      };
    }, [data, colors, width, height, chartWidth, chartHeight, title, titleFont, greyscale]);

    return (
      <div
        ref={containerRef}
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          padding: '16px',
          margin: '16px 0',
        }}
      >
        <svg
          ref={svgRef}
          style={{ width: '100%', maxWidth: '100%', display: 'block', height: `${height}px` }}
        />
      </div>
    );
  },
);
