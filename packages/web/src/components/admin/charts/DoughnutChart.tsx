/**
 * DoughnutChart - Proportional doughnut chart using Recharts
 */

import { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const DEFAULT_COLORS = [
  'rgba(59, 130, 246, 0.8)',
  'rgba(16, 185, 129, 0.8)',
  'rgba(245, 158, 11, 0.8)',
  'rgba(239, 68, 68, 0.8)',
  'rgba(139, 92, 246, 0.8)',
  'rgba(107, 114, 128, 0.8)',
];

interface DoughnutChartProps {
  labels: string[];
  data: number[];
  colors?: string[];
  showLegend?: boolean;
  legendPosition?: 'right' | 'bottom';
  cutout?: string;
  className?: string;
}

export function DoughnutChart({
  labels,
  data,
  colors = DEFAULT_COLORS,
  showLegend = true,
  legendPosition = 'right',
  className = 'h-64',
}: DoughnutChartProps) {
  const chartData = useMemo(() => {
    return labels.map((lbl, i) => ({
      name: lbl,
      value: data[i] ?? 0,
    }));
  }, [labels, data]);

  const total = useMemo(() => data.reduce((a, b) => a + b, 0), [data]);

  return (
    <div className={className}>
      <ResponsiveContainer width='100%' height='100%'>
        <PieChart>
          <Pie
            data={chartData}
            dataKey='value'
            nameKey='name'
            cx='50%'
            cy='50%'
            innerRadius='60%'
            outerRadius='80%'
            paddingAngle={1}
            stroke='none'
          >
            {chartData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: any, name: any) => {
              const numVal = Number(value);
              const pct = total > 0 ? ((numVal / total) * 100).toFixed(1) : '0';
              return [`${numVal} (${pct}%)`, name];
            }}
          />
          {showLegend && (
            <Legend
              layout={legendPosition === 'right' ? 'vertical' : 'horizontal'}
              align={legendPosition === 'right' ? 'right' : 'center'}
              verticalAlign={legendPosition === 'right' ? 'middle' : 'bottom'}
              iconType='circle'
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
