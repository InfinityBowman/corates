import { onCleanup, createEffect, createSignal } from 'solid-js'
import * as d3 from 'd3'

/**
 * Props:
 * - data: Array of { label: string, questions: Array<"yes"|"partial yes"|"no"|"no ma"> }
 * - width: number (default: 900)
 * - height: number (default: 600)
 * - title: string (default: "AMSTAR-2 Quality Assessment")
 * - greyscale: boolean (default: false) - use greyscale colors
 * - ref: (el) => void - optional ref callback for accessing the SVG element
 */
export default function AMSTARRobvis(props) {
  let ref = null

  // Expose ref to parent if provided
  const setRef = (el) => {
    ref = el
    if (typeof props.ref === 'function') {
      props.ref(el)
    }
  }
  const [containerSize, setContainerSize] = createSignal({
    width: 800,
    height: 500,
  })

  // Responsive: observe parent container size with ResizeObserver
  createEffect(() => {
    if (!ref || !ref.parentElement) return

    function updateSize() {
      if (ref && ref.parentElement) {
        const rect = ref.parentElement.getBoundingClientRect()
        // Only update if we have actual dimensions (not hidden)
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({
            // Minimum size to avoid too small charts (600, 400)
            width: Math.max(rect.width, 600),
            height: Math.max(rect.height, 400),
          })
        }
      }
    }

    // Use ResizeObserver to detect when element becomes visible
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          updateSize()
        }
      }
    })

    resizeObserver.observe(ref.parentElement)
    updateSize()
    window.addEventListener('resize', updateSize)

    onCleanup(() => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateSize)
    })
  })

  const data = () => props.data ?? []
  const nQuestions = 16
  const width = () => props.width ?? containerSize().width
  const height = () => props.height ?? containerSize().height
  const title = () => props.title ?? 'AMSTAR-2 Quality Assessment'
  const greyscale = () => props.greyscale ?? false

  // Dynamically calculate left margin based on label width
  const [dynamicMarginLeft, setDynamicMarginLeft] = createSignal(200)

  // Make margin reactive - increase bottom margin when only one checklist for better Q label visibility
  const margin = () => ({
    top: 60,
    right: 170,
    bottom: data().length <= 1 ? 80 : 60,
    left: dynamicMarginLeft(),
  })

  // Calculate max cell size that keeps squares and fits both axes
  const cellSizeX = () =>
    Math.max(0, (width() - margin().left - margin().right) / nQuestions)
  const cellSizeY = () =>
    Math.max(
      0,
      (height() - margin().top - margin().bottom) / Math.max(data().length, 1),
    )
  const cellSize = () => Math.max(0, Math.min(cellSizeX(), cellSizeY()))

  // Adjust chart area to fit grid
  const chartWidth = () => Math.max(0, cellSize() * nQuestions)
  const chartHeight = () => Math.max(0, cellSize() * Math.max(data().length, 1))
  const svgWidth = () =>
    Math.max(0, margin().left + chartWidth() + margin().right)
  const svgHeight = () =>
    Math.max(0, margin().top + chartHeight() + margin().bottom)

  const colorMapDefault = {
    yes: '#10b981',
    'partial yes': '#facc15',
    no: '#ef4444',
    'no ma': '#9ca3af',
  }

  // https://dev.to/finnhvman/grayscale-color-palette-with-equal-contrast-ratios-2pgl
  const colorMapGreyscale = {
    yes: '#1b1b1b',
    'partial yes': '#484848',
    no: '#727272',
    'no ma': '#a2a2a2',
  }

  const colorMap = () => (greyscale() ? colorMapGreyscale : colorMapDefault)

  createEffect(() => {
    // Track greyscale changes to re-render and capture reactive values
    const colors = colorMap()
    const cSize = cellSize()
    if (!data().length) return

    // Prevent rendering if dimensions are invalid
    if (cSize <= 0 || svgWidth() <= 0 || svgHeight() <= 0) {
      return
    }

    // First, measure the widest label
    if (ref) {
      // Create a temporary SVG to measure text width
      const tempSvg = d3
        .select(document.body)
        .append('svg')
        .style('visibility', 'hidden')
        .style('position', 'absolute')
      let maxLabelWidth = 0
      data().forEach((row) => {
        const tempText = tempSvg
          .append('text')
          .attr('font-size', '12px')
          .attr('font-weight', '500')
          .text(row.label)
        const bbox = tempText.node().getBBox()
        if (bbox.width > maxLabelWidth) maxLabelWidth = bbox.width
        tempText.remove()
      })
      tempSvg.remove()
      // Add padding and set margin (minimum 150px for short labels)
      const newMargin = Math.max(150, Math.ceil(maxLabelWidth + 20))
      setDynamicMarginLeft(newMargin)
    }

    // Get current margin values
    const m = margin()

    const svg = d3
      .select(ref)
      .attr('width', svgWidth())
      .attr('height', svgHeight())
      .style('background', '#ffffff')
      .style(
        'font-family',
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      )

    svg.selectAll('*').remove()

    // Column headers at bottom
    const footerGroup = svg.append('g').attr('class', 'footer')

    footerGroup
      .selectAll('text')
      .data(d3.range(1, nQuestions + 1))
      .enter()
      .append('text')
      .attr('x', (d, i) => m.left + i * cSize + cSize / 2)
      .attr('y', m.top + chartHeight() + 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', Math.max(10, cSize * 0.4))
      .attr('font-weight', '600')
      .attr('fill', '#374151')
      .text((d) => `Q${d}`)

    // Row labels with alternating background
    const rowGroup = svg.append('g').attr('class', 'rows')

    rowGroup
      .selectAll('text')
      .data(data())
      .enter()
      .append('text')
      .attr('x', m.left - 10)
      .attr('y', (_, i) => m.top + i * cSize + cSize / 2)
      .attr('text-anchor', 'end')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('fill', '#374151')
      .attr('dominant-baseline', 'middle')
      .text((d) => d.label)

    // Traffic light cells
    const cellGroup = svg.append('g').attr('class', 'cells')

    data().forEach((row, rowIdx) => {
      for (let colIdx = 0; colIdx < nQuestions; colIdx++) {
        const value = row.questions[colIdx]?.toLowerCase?.() ?? ''
        const cellColor = colors[value] ?? '#e5e7eb'

        // Ensure cell size is positive before drawing
        const cellWidth = Math.max(0, cSize - 4)
        const cellHeight = Math.max(0, cSize - 4)

        if (cellWidth > 0 && cellHeight > 0) {
          // Traffic light cell - filled rectangle
          cellGroup
            .append('rect')
            .attr('x', m.left + colIdx * cSize + 2)
            .attr('y', m.top + rowIdx * cSize + 2)
            .attr('width', cellWidth)
            .attr('height', cellHeight)
            .attr('fill', cellColor)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .attr('rx', Math.max(2, cSize * 0.12))
            .style('filter', 'drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.1))')
        }
      }
    })

    // Legend
    const legendData = [
      { key: 'yes', label: 'Yes' },
      { key: 'partial yes', label: 'Partial Yes' },
      { key: 'no', label: 'No' },
      { key: 'no ma', label: 'No MA' },
    ]

    const legend = svg
      .append('g')
      .attr('class', 'legend')
      .attr(
        'transform',
        `translate(${svgWidth() - m.right + 20}, ${m.top + 20})`,
      )

    const legendItems = legend
      .selectAll('.legend-item')
      .data(legendData)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 25})`)

    legendItems
      .append('rect')
      .attr('x', 0)
      .attr('y', -8)
      .attr('width', 16)
      .attr('height', 16)
      .attr('rx', 2)
      .attr('fill', (d) => colors[d.key])
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1)

    legendItems
      .append('text')
      .attr('x', 24)
      .attr('y', 0)
      .attr('dy', '0.35em')
      .attr('font-size', '13px')
      .attr('font-weight', '500')
      .attr('fill', '#374151')
      .text((d) => d.label)

    // Title
    svg
      .append('text')
      .attr('x', svgWidth() / 2)
      .attr('y', 40)
      .attr('text-anchor', 'middle')
      .attr('font-size', '18px')
      .attr('font-weight', '600')
      .attr('fill', '#111827')
      .text(title())

    // Cleanup function
    onCleanup(() => {
      svg.selectAll('*').remove()
    })
  })

  return (
    <div
      style={{
        background: '#ffffff',
        'border-radius': '8px',
        'box-shadow':
          '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        padding: '16px',
        margin: '16px 0',
      }}
    >
      <svg
        ref={(el) => setRef(el)}
        style={{
          width: '100%',
          'max-width': '100%',
          display: 'block',
          height: `${svgHeight()}px`,
        }}
      />
    </div>
  )
}
