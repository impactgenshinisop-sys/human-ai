import React from 'react';

interface SparklineProps {
  data: number[];
  color: string;
  label: string;
  currentValue: string | number;
  height?: number;
}

export const SparklineCard: React.FC<SparklineProps> = ({
  data,
  color,
  label,
  currentValue,
  height = 34,
}) => {
  const width = 120;
  const pts = data.length > 1 ? data : [0, Number(currentValue) || 1];
  const min = Math.min(...pts, 0);
  const max = Math.max(...pts, min + 1);

  const polylinePoints = pts
    .map((val, idx) => {
      const x = (idx / Math.max(1, pts.length - 1)) * width;
      const y = height - ((val - min) / (max - min)) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="bg-slate-900/90 border border-white/10 rounded-lg p-2.5 flex flex-col justify-between">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[11px] text-slate-400 truncate">{label}</span>
        <span
          className="text-xs font-semibold font-mono-tabular"
          style={{ color }}
        >
          {currentValue}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-8 overflow-visible"
      >
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylinePoints}
        />
      </svg>
    </div>
  );
};
