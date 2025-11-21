import { onMount, createSignal } from 'solid-js';
import * as d3 from 'd3';

function Chart() {
  let svgRef: SVGSVGElement | undefined;
  const [data] = createSignal([30, 86, 168, 281, 303, 365]);

  onMount(() => {
    if (!svgRef) return;

    const width = 500;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const svg = d3.select(svgRef).attr('width', width).attr('height', height);

    const x = d3
      .scaleBand()
      .domain(data().map((_, i) => i.toString()))
      .range([margin.left, width - margin.right])
      .padding(0.1);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data()) as number])
      .nice()
      .range([height - margin.bottom, margin.top]);

    svg
      .append('g')
      .attr('fill', 'steelblue')
      .selectAll('rect')
      .data(data())
      .join('rect')
      .attr('x', (_, i) => x(i.toString()) as number)
      .attr('y', d => y(d))
      .attr('height', d => y(0) - y(d))
      .attr('width', x.bandwidth());

    svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x));

    svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y));
  });

  return (
    <div class="bg-white p-4 rounded-lg shadow">
      <h3 class="text-lg font-semibold mb-2">Sample D3 Chart</h3>
      <svg ref={svgRef}></svg>
    </div>
  );
}

export default Chart;
