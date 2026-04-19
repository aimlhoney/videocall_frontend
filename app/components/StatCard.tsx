'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface TrendPoint {
  date: string;
  rooms: number;
  participants: number;
  visitors: number;
}

function useCountUp(target: number, duration = 1400) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    let current = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        setValue(target);
        clearInterval(timer);
      } else {
        setValue(Math.floor(current));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);

  return value;
}

export function StatCard({
  label,
  value,
  icon,
  color,
  trend,
  trendKey,
}: {
  label: string;
  value: number;
  icon: string;
  color: string;
  trend: TrendPoint[];
  trendKey: keyof TrendPoint;
}) {
  const animated = useCountUp(value);

  return (
    <div style={{ background: '#fff', border: '1px solid #e7e7e7', borderRadius: 20, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#111', lineHeight: 1 }}>
            {animated.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{label}</div>
        </div>
      </div>

      <div style={{ height: 52 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${trendKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid #e7e7e7', borderRadius: 10, fontSize: 12, padding: '4px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              itemStyle={{ color: '#111' }}
              labelStyle={{ color: '#666', fontSize: 11 }}
            />
            <Area
              type="monotone"
              dataKey={trendKey as string}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${trendKey})`}
              dot={false}
              activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ fontSize: 11, color: '#bbb' }}>Last 7 days</div>
    </div>
  );
}