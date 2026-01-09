/**
 * Bar chart component for categorical data
 * Uses Chart.js with solid-chartjs wrapper
 */

import { Bar } from 'solid-chartjs';
import { createMemo } from 'solid-js';
import {
  Chart,
  Title,
  Tooltip,
  Legend,
  Colors,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js';

// Register Chart.js components
Chart.register(Title, Tooltip, Legend, Colors, BarElement, CategoryScale, LinearScale);

export default function BarChart(props) {
  const chartData = createMemo(() => ({
    labels: props.labels || [],
    datasets: props.datasets || [
      {
        label: props.label || 'Data',
        data: props.data || [],
        backgroundColor: props.colors || [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
        ],
        borderRadius: 4,
      },
    ],
  }));

  const chartOptions = createMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: props.showLegend ?? false,
        position: 'top',
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
    ...props.options,
  }));

  return (
    <div class={props.class || 'h-64'}>
      <Bar data={chartData()} options={chartOptions()} />
    </div>
  );
}
