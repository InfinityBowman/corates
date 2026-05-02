import { useProjectStats, useProjectReactor } from '../reactor/hooks';
import { RenderTracker } from './RenderTracker';
import { useState } from 'react';
import type { StudySnapshot } from '../reactor/core';

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: '8px 12px',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
    </div>
  );
}

export function StatsPanel() {
  const stats = useProjectStats();
  const reactor = useProjectReactor();
  const [exportData, setExportData] = useState<StudySnapshot[] | null>(null);

  return (
    <RenderTracker label="StatsPanel (computed atoms)">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <StatBadge label="Total" value={stats.total} />
        <StatBadge label="Completed" value={stats.completed} />
        <StatBadge label="Unassigned" value={stats.unassigned} />
      </div>

      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
        Stats are a single computed atom reading across all study/checklist
        field atoms. Only re-renders when a count actually changes.
      </div>

      <button
        onClick={() => setExportData(reactor.snapshotAll())}
        style={{
          padding: '6px 12px',
          fontSize: 12,
          border: '1px solid #d1d5db',
          borderRadius: 6,
          background: '#fff',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        Export snapshot (on-demand, not reactive)
      </button>

      {exportData && (
        <pre
          style={{
            fontSize: 11,
            background: '#f8f9fa',
            padding: 8,
            borderRadius: 6,
            maxHeight: 200,
            overflow: 'auto',
            marginTop: 8,
          }}
        >
          {JSON.stringify(exportData, null, 2)}
        </pre>
      )}
    </RenderTracker>
  );
}
