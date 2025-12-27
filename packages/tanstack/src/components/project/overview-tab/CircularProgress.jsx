/**
 * CircularProgress - Circular progress indicator using D3
 */

import { createEffect } from 'solid-js'
import * as d3 from 'd3'

export default function CircularProgress(props) {
  let svgRef = null

  const value = () => props.value ?? 0
  const label = () => props.label ?? ''
  const showValue = () => props.showValue ?? false
  const variant = () => props.variant ?? 'default'
  const size = () => props.size ?? 120 // Default size in pixels

  const getVariantColor = () => {
    switch (variant()) {
      case 'success':
        return '#10b981' // green-500
      case 'warning':
        return '#eab308' // yellow-500
      case 'error':
        return '#ef4444' // red-500
      default:
        return '#3b82f6' // blue-500
    }
  }

  const clampedValue = () => Math.max(0, Math.min(100, value()))

  createEffect(() => {
    if (!svgRef) return

    const radius = size() / 2 - 8 // Leave some padding
    const centerX = size() / 2
    const centerY = size() / 2
    const strokeWidth = 8

    // Clear previous content
    d3.select(svgRef).selectAll('*').remove()

    const svg = d3.select(svgRef).attr('width', size()).attr('height', size())

    // Create arc generator
    const arc = d3
      .arc()
      .innerRadius(radius - strokeWidth / 2)
      .outerRadius(radius + strokeWidth / 2)
      .cornerRadius(4)

    const group = svg
      .append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`)

    // Background circle (full 360 degrees)
    const backgroundArc = arc({
      startAngle: 0,
      endAngle: 2 * Math.PI,
    })

    group.append('path').attr('d', backgroundArc).attr('fill', '#e5e7eb') // gray-200

    // Progress arc
    const progressAngle = (clampedValue() / 100) * 2 * Math.PI
    const progressArcData = {
      startAngle: -Math.PI / 2, // Start from top
      endAngle: -Math.PI / 2 + progressAngle,
    }

    // Initialize with 0 angle for smooth animation
    const progressPath = group
      .append('path')
      .datum({
        startAngle: -Math.PI / 2,
        endAngle: -Math.PI / 2,
      })
      .attr('d', arc)
      .attr('fill', getVariantColor())

    // Animate to actual progress
    progressPath
      .transition()
      .duration(800)
      .ease(d3.easeCubicOut)
      .attrTween('d', function (d) {
        const interpolate = d3.interpolate(d.endAngle, progressArcData.endAngle)
        return function (t) {
          d.endAngle = interpolate(t)
          return arc(d)
        }
      })

    // Center text - percentage
    if (showValue()) {
      svg
        .append('text')
        .attr('x', centerX)
        .attr('y', centerY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '24px')
        .attr('font-weight', 'bold')
        .attr('fill', '#111827') // gray-900
        .text(`${Math.round(clampedValue())}%`)
        .attr('opacity', 0)
        .transition()
        .duration(800)
        .ease(d3.easeCubicOut)
        .attr('opacity', 1)
    }

    // Center text - label (if provided, show below value)
    if (label()) {
      const currentLabel = label()
      const currentSize = size()
      const labelY = showValue() ? centerY + 28 : centerY
      svg
        .append('text')
        .attr('x', centerX)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '11px')
        .attr('fill', '#6b7280') // gray-500
        .text(currentLabel)
        .attr('opacity', 0)
        .transition()
        .duration(800)
        .ease(d3.easeCubicOut)
        .attr('opacity', 1)
        .call((text) => {
          // Truncate text if too long
          const maxLength = Math.floor((currentSize * 0.75) / 6) // Approximate chars that fit
          const textElement = text.node()
          if (textElement && currentLabel.length > maxLength) {
            textElement.textContent =
              currentLabel.substring(0, maxLength - 3) + '...'
          }
        })
    }
  })

  return (
    <div class="flex items-center justify-center">
      <svg ref={svgRef} class="overflow-visible" />
    </div>
  )
}
