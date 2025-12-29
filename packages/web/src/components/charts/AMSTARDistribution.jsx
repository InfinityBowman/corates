import { onCleanup, createEffect, createSignal, onMount } from 'solid-js';
import * as d3 from 'd3';

/**
 * Props:
 * - data: Array of { label: string, questions: Array<"yes"|"partial yes"|"no"|"no ma"> }
 * - width: number (default: 900)
 * - height: number (default: 600)
 * - title: string (default: "Distribution of AMSTAR Ratings on Each Item Across Included Reviews")
 * - greyscale: boolean (default: false) - use greyscale colors
 * - ref: (el) => void - optional ref callback for accessing the SVG element
 */
export default function AMSTARDistribution(props) {
  let ref = null;
  let containerRef = null;

  // Expose ref to parent if provided
  const setRef = el => {
    ref = el;
    if (typeof props.ref === 'function') {
      props.ref(el);
    }
  };
  const data = () => props.data ?? [];
  const [containerSize, setContainerSize] = createSignal({ width: 900, height: 600 });

  // Observe parent container size with ResizeObserver
  onMount(() => {
    if (!containerRef) return;

    const resize = () => {
      if (containerRef) {
        const rect = containerRef.getBoundingClientRect();
        // Only update if we have actual dimensions (not hidden)
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({
            width: Math.max(rect.width, 400),
            height: Math.max(rect.height, 400),
          });
        }
      }
    };

    // Use ResizeObserver to detect when element becomes visible
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          resize();
        }
      }
    });

    resizeObserver.observe(containerRef);
    resize();
    window.addEventListener('resize', resize);

    onCleanup(() => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
    });
  });

  const width = () => props.width ?? containerSize().width;
  const height = () => props.height ?? containerSize().width / 1.5;
  const title = () => props.title ?? 'Level Judgments Across Included Reviews';
  const greyscale = () => props.greyscale ?? false;

  const margin = { top: 50, right: 150, bottom: 60, left: 80 };
  const chartWidth = () => Math.max(0, width() - margin.left - margin.right);
  const chartHeight = () => Math.max(0, height() - margin.top - margin.bottom);
  // Responsive font size based on width
  const titleFont = () => Math.max(Math.round(width() / 50), 12) + 1; // e.g. 900px => 18px, 400px => 10px

  const colorMapDefault = {
    yes: '#10b981',
    'partial yes': '#facc15',
    no: '#ef4444',
    'no ma': '#9ca3af',
  };

  const colorMapGreyscale = {
    yes: '#1b1b1b',
    'partial yes': '#484848',
    no: '#727272',
    'no ma': '#a2a2a2',
  };

  const colorMap = () => (greyscale() ? colorMapGreyscale : colorMapDefault);

  createEffect(() => {
    // Track greyscale changes to re-render and capture the value
    const colors = colorMap();
    if (!data().length) return;

    // Prevent rendering if dimensions are invalid
    const w = width();
    const h = height();
    if (w <= 0 || h <= 0 || chartWidth() <= 0 || chartHeight() <= 0) {
      return;
    }

    const svg = d3
      .select(ref)
      .attr('width', w)
      .attr('height', h)
      .style('background', '#ffffff')
      .style('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif');

    svg.selectAll('*').remove();

    // Process data to calculate percentages for each question
    const processedData = [];
    const nQuestions = Math.max(...data().map(d => d.questions?.length || 0));
    const totalStudies = data().length;

    for (let q = 0; q < nQuestions; q++) {
      const questionData = {
        question: q + 1,
        label: `Q${q + 1}`, // You can customize these labels
        counts: { yes: 0, 'partial yes': 0, no: 0, 'no ma': 0 },
      };

      // Count responses for this question
      data().forEach(study => {
        const response = study.questions[q]?.toLowerCase?.() ?? 'no ma';
        if (Object.hasOwn(questionData.counts, response)) {
          questionData.counts[response]++;
        }
      });

      // Convert to percentages
      questionData.percentages = {};
      Object.keys(questionData.counts).forEach(key => {
        questionData.percentages[key] = (questionData.counts[key] / totalStudies) * 100;
      });

      processedData.push(questionData);
    }

    // Create scales - ensure chart dimensions are positive
    const safeChartHeight = Math.max(1, chartHeight());
    const safeChartWidth = Math.max(1, chartWidth());

    const yScale = d3
      .scaleBand()
      .domain(processedData.map(d => d.label))
      .range([0, safeChartHeight])
      .padding(0.1);

    const xScale = d3.scaleLinear().domain([0, 100]).range([0, safeChartWidth]);

    // Create main chart group
    const chartGroup = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Add title
    svg
      .append('text')
      .attr('x', width() / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', titleFont() + 'px')
      .attr('font-weight', '600')
      .attr('fill', '#111827')
      .text(title());

    // Create stacked bars
    processedData.forEach(d => {
      let cumulativePercent = 0;
      const barHeight = Math.max(0, yScale.bandwidth());
      const y = yScale(d.label);

      // Draw each segment
      ['yes', 'partial yes', 'no ma', 'no'].forEach(category => {
        const percent = d.percentages[category];
        const segmentWidth = Math.max(0, xScale(percent));

        if (percent > 0 && segmentWidth > 0 && barHeight > 0) {
          // Bar segment
          chartGroup
            .append('rect')
            .attr('x', xScale(cumulativePercent))
            .attr('y', y)
            .attr('width', segmentWidth)
            .attr('height', barHeight)
            .attr('fill', colors[category])
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1);

          // Add percentage label if segment is large enough
          if (percent >= 5) {
            // Determine text color based on background
            const isLightBg =
              greyscale() ? category === 'no' || category === 'no ma' : category === 'partial yes';

            chartGroup
              .append('text')
              .attr('x', xScale(cumulativePercent) + segmentWidth / 2)
              .attr('y', y + barHeight / 2)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .attr('font-size', '12px')
              .attr('font-weight', '600')
              .attr('fill', isLightBg ? '#000000' : '#ffffff')
              .text(`${percent.toFixed(1)}`);
          }
        }

        cumulativePercent += percent;
      });
    });

    // Add Y-axis labels (question labels)
    chartGroup
      .selectAll('.y-label')
      .data(processedData)
      .enter()
      .append('text')
      .attr('class', 'y-label')
      .attr('x', -10)
      .attr('y', d => yScale(d.label) + yScale.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '13px')
      .attr('font-weight', '500')
      .attr('fill', '#374151')
      .text(d => d.label);

    // Add X-axis
    const xAxis = d3
      .axisBottom(xScale)
      .tickFormat(d => `${d}`)
      .ticks(5);

    chartGroup
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${chartHeight()})`)
      .call(xAxis)
      .selectAll('text')
      .attr('font-size', '12px')
      .attr('fill', '#374151');

    // Add X-axis label
    chartGroup
      .append('text')
      .attr('x', chartWidth() / 2)
      .attr('y', chartHeight() + 50)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', '500')
      .attr('fill', '#374151')
      .text(`Percentage of SRs (%), N=${totalStudies}`);

    // Add Y-axis label
    svg
      .append('text')
      .attr('transform', `rotate(-90)`)
      .attr('x', -height() / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', '500')
      .attr('fill', '#374151')
      .text('Items of AMSTAR-2');

    // Add legend
    const legend = svg
      .append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${width() - margin.right + 20}, ${margin.top + 20})`);

    const legendData = [
      { key: 'yes', label: 'Yes' },
      { key: 'partial yes', label: 'Partial Yes' },
      { key: 'no', label: 'No' },
      { key: 'no ma', label: 'No MA' },
    ];

    const legendItems = legend
      .selectAll('.legend-item')
      .data(legendData)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 25})`);

    legendItems
      .append('rect')
      .attr('x', 0)
      .attr('y', -8)
      .attr('width', 16)
      .attr('height', 16)
      .attr('rx', 2)
      .attr('fill', d => colors[d.key])
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1);

    legendItems
      .append('text')
      .attr('x', 24)
      .attr('y', 0)
      .attr('dy', '0.35em')
      .attr('font-size', '13px')
      .attr('font-weight', '500')
      .attr('fill', '#374151')
      .text(d => d.label);

    // Cleanup
    onCleanup(() => {
      svg.selectAll('*').remove();
    });
  });

  return (
    <div
      ref={containerRef}
      style={{
        background: '#ffffff',
        'border-radius': '8px',
        'box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        padding: '16px',
        margin: '16px 0',
      }}
    >
      <svg
        ref={el => setRef(el)}
        style={{
          width: '100%',
          'max-width': '100%',
          display: 'block',
          height: `${height()}px`,
        }}
      />
    </div>
  );
}
