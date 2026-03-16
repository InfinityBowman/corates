/**
 * BarChart - Categorical bar chart using Recharts
 */

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';

const DEFAULT_COLORS = [
  'rgba(59, 130, 246, 0.8)',
  'rgba(16, 185, 129, 0.8)',
  'rgba(245, 158, 11, 0.8)',
  'rgba(239, 68, 68, 0.8)',
  'rgba(139, 92, 246, 0.8)',
  'rgba(236, 72, 153, 0.8)',
];

interface BarChartProps {
  labels: string[];
  data: number[];
  label?: string;
  colors?: string[];
  showLegend?: boolean;
  className?: string;
}

export function BarChart({
  labels,
  data,
  label = 'Data',
  colors = DEFAULT_COLORS,
  showLegend = false,
  className = 'h-64',
}: BarChartProps) {
  const chartData = useMemo(() => {
    return labels.map((lbl, i) => ({
      name: lbl,
      [label]: data[i] ?? 0,
    }));
  }, [labels, data, label]);

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          {showLegend && <Legend />}
          <Bar dataKey={label} radius={[4, 4, 0, 0]}>
            {chartData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
