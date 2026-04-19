'use client';

import { useEffect, useState } from 'react';
import { StatsSidebar } from './components/StatsSidebar';
import { MeetingPanel } from './components/MeetingPanel';
import { TrendPoint } from './components/StatCard';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';


interface Stats {
  totalRooms: number;
  totalParticipants: number;
  totalVisitors: number;
  activeRooms: number;
  trend: TrendPoint[];
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({
    totalRooms: 0,
    totalParticipants: 0,
    totalVisitors: 0,
    activeRooms: 0,
    trend: [],
  });

  useEffect(() => {
    fetch(`${API}/api/stats/visit`, { method: 'POST' }).catch(() => {});
    fetch(`${API}/api/stats`)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  return (
   
  <div style={{
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'clamp(12px, 4vw, 24px)',
    boxSizing: 'border-box',
  }}>
    <div style={{
      width: '100%',
      maxWidth: 1080,
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: 20,
      alignItems: 'center',
    }}>
      <div className="stats-panel">
        <StatsSidebar
          totalRooms={stats.totalRooms}
          totalParticipants={stats.totalParticipants}
          totalVisitors={stats.totalVisitors}
          activeRooms={stats.activeRooms}
          trend={stats.trend}
        />
      </div>
      <MeetingPanel />
    </div>
  </div>
);
 
}