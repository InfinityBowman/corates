/**
 * LineChart - Time series line chart using Recharts
 */

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
  color = '#3b82f6',
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
      return datasets.map(ds => (
        <Line
          key={ds.label}
          type='monotone'
          dataKey={ds.label}
          stroke={ds.color || color}
          fill={ds.fill ? `${ds.color || color}1A` : 'transparent'}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      ));
    }
    return (
      <Line
        type='monotone'
        dataKey={label}
        stroke={color}
        fill={fill ? `${color}1A` : 'transparent'}
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
