import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

/**
 * Translucent area fill from any CSS color (hex, rgb, or var(--x)); a plain
 * `${color}1A` hex-append produces invalid colors for rgb()/var() inputs.
 */
const fillFromColor = (color: string, percent = 12): string =>
  `color-mix(in oklab, ${color} ${percent}%, transparent)`;

interface Dataset {
  label: string;
  data: number[];
  color?: string;
  fill?: boolean;
}

interface LineChartProps {
  labels: string[];
  data?: number[];
  datasets?: Dataset[];
  label?: string;
  color?: string;
  fill?: boolean;
  showLegend?: boolean;
  maxXTicks?: number;
  className?: string;
}

export function LineChart({
  labels,
  data: singleData,
  datasets,
  label = 'Data',
  color = 'var(--chart-cat-1)',
  fill = false,
  showLegend = false,
  className = 'h-64',
}: LineChartProps) {
  const chartData = useMemo(() => {
    return labels.map((lbl, i) => {
      const point: Record<string, any> = { name: lbl };
      if (datasets) {
        datasets.forEach(ds => {
          point[ds.label] = ds.data[i] ?? 0;
        });
      } else {
        point[label] = singleData?.[i] ?? 0;
      }
      return point;
    });
  }, [labels, singleData, datasets, label]);

  const lines = useMemo(() => {
    if (datasets) {
      return datasets.map(ds => {
        const strokeColor = ds.color || 'var(--chart-cat-1)';
        return (
          <Line
            key={ds.label}
            type='monotone'
            dataKey={ds.label}
            stroke={strokeColor}
            fill={ds.fill ? fillFromColor(strokeColor) : 'transparent'}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        );
      });
    }
    return (
      <Line
        type='monotone'
        dataKey={label}
        stroke={color}
        fill={fill ? fillFromColor(color) : 'transparent'}
        strokeWidth={2}
        dot={{ r: 3 }}
        activeDot={{ r: 5 }}
      />
    );
  }, [datasets, label, color, fill]);

  return (
    <div className={className}>
      <ResponsiveContainer width='100%' height='100%'>
        <RechartsLineChart data={chartData}>
          <CartesianGrid strokeDasharray='3 3' vertical={false} />
          <XAxis dataKey='name' tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          {showLegend && <Legend />}
          {lines}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
