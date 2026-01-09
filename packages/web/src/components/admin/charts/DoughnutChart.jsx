/**
 * Doughnut chart component for proportional data
 * Uses Chart.js with solid-chartjs wrapper
 */

import { Doughnut } from 'solid-chartjs';
import { createMemo } from 'solid-js';
import { Chart, Title, Tooltip, Legend, Colors, ArcElement } from 'chart.js';

// Register Chart.js components
Chart.register(Title, Tooltip, Legend, Colors, ArcElement);

export default function DoughnutChart(props) {
  const chartData = createMemo(() => ({
    labels: props.labels || [],
    datasets: [
      {
        data: props.data || [],
        backgroundColor: props.colors || [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(107, 114, 128, 0.8)',
        ],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  }));

  const chartOptions = createMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: props.showLegend ?? true,
        position: props.legendPosition || 'right',
        labels: {
          usePointStyle: true,
          padding: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: context => {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
    cutout: props.cutout || '60%',
    ...props.options,
  }));

  return (
    <div class={props.class || 'h-64'}>
      <Doughnut data={chartData()} options={chartOptions()} />
    </div>
  );
}
