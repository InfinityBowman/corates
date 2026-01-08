/**
 * Line chart component for time series data
 * Uses Chart.js with solid-chartjs wrapper
 */

import { Line } from 'solid-chartjs';
import { createMemo } from 'solid-js';
import {
  Chart,
  Title,
  Tooltip,
  Legend,
  Colors,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
} from 'chart.js';

// Register Chart.js components
Chart.register(
  Title,
  Tooltip,
  Legend,
  Colors,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
);

export default function LineChart(props) {
  const chartData = createMemo(() => ({
    labels: props.labels || [],
    datasets: props.datasets || [
      {
        label: props.label || 'Data',
        data: props.data || [],
        borderColor: props.color || 'rgb(59, 130, 246)',
        backgroundColor: props.fill ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
        fill: props.fill || false,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
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
        ticks: {
          maxTicksLimit: props.maxXTicks || 10,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
    ...props.options,
  }));

  return (
    <div class={props.class || 'h-64'}>
      <Line data={chartData()} options={chartOptions()} />
    </div>
  );
}
