/**
 * CircularProgress - SVG circular progress indicator
 * Pure SVG implementation (no D3 dependency for this simple use case)
 */

interface CircularProgressProps {
  value: number;
  label?: string;
  showValue?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: number;
}

const VARIANT_COLORS: Record<string, string> = {
  success: '#10b981',
  warning: '#eab308',
  error: '#ef4444',
  default: '#3b82f6',
};

export function CircularProgress({
  value = 0,
  showValue = false,
  variant = 'default',
  size = 120,
}: CircularProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const strokeWidth = 8;
  const radius = size / 2 - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;
  const color = VARIANT_COLORS[variant] || VARIANT_COLORS.default;

  return (
    <div className='flex items-center justify-center'>
      <svg width={size} height={size} className='overflow-visible'>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill='none'
          stroke='var(--border, #e5e7eb)'
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill='none'
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap='round'
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.33, 1, 0.68, 1)' }}
        />
        {/* Center text */}
        {showValue && (
          <text
            x={size / 2}
            y={size / 2}
            textAnchor='middle'
            dominantBaseline='central'
            fontSize='24'
            fontWeight='bold'
            fill='var(--foreground, #111827)'
          >
            {Math.round(clamped)}%
          </text>
        )}
      </svg>
    </div>
  );
}
