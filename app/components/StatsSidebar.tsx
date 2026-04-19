'use client';

import { TrendPoint } from './StatCard';
import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const cardStyle = (color: string) => ({
  background: `#fff`,
  border: '1px solid #e7e7e7',
  borderRadius: 16,
  padding: '16px 18px',
  backdropFilter: 'blur(10px)',
});

export function StatsSidebar({
  totalRooms,
  totalParticipants,
  totalVisitors,
  activeRooms,
  trend,
}: {
  totalRooms: number;
  totalParticipants: number;
  totalVisitors: number;
  activeRooms: number;
  trend: TrendPoint[];
}) {
  const stats = [
    { label: 'Rooms Created', value: totalRooms, color: '#6366f1', icon: '🏠', key: 'rooms' },
    { label: 'Participants', value: totalParticipants, color: '#10b981', icon: '👥', key: 'participants' },
    { label: 'Visitors', value: totalVisitors, color: '#f59e0b', icon: '🌐', key: 'visitors' },
    { label: 'Active Now', value: activeRooms, color: '#ef4444', icon: '🔴', key: 'rooms' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Title */}
      <div style={{ marginBottom: 4 }}>
        
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888' }}>
          Live stats from the last 7 days
        </p>
      </div>

      {/* Stat Cards — 2x2 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {stats.map((s) => (
          <div key={s.label} style={cardStyle(s.color)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: `${s.color}22`,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 15,
                border: `1px solid ${s.color}33`,
              }}>
                {s.icon}
              </div>
              <span style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>
                {s.label}
              </span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111', lineHeight: 1 }}>
              {s.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Charts — 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

        {/* Chart 1 */}
        <div style={{
          background: '#fff',
          border: '1px solid #e7e7e7',
          borderRadius: 16, padding: '14px 14px 8px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 10 }}>
            Rooms & Participants
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={trend} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#bbb' }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e7e7e7', borderRadius: 8, fontSize: 11, color: '#111' }}
              />
              <Area type="monotone" dataKey="rooms" stroke="#6366f1" strokeWidth={1.5} fill="url(#gR)" dot={false} name="Rooms" />
              <Area type="monotone" dataKey="participants" stroke="#10b981" strokeWidth={1.5} fill="url(#gP)" dot={false} name="Participants" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2 */}
        <div style={{
          background: '#fff',
          border: '1px solid #e7e7e7',
          borderRadius: 16, padding: '14px 14px 8px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 10 }}>
            Platform Visitors
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={trend} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#bbb' }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e7e7e7', borderRadius: 8, fontSize: 11, color: '#111' }}
              />
              <Area type="monotone" dataKey="visitors" stroke="#f59e0b" strokeWidth={1.5} fill="url(#gV)" dot={false} name="Visitors" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

      </div>

    </div>
  );
}