import { useMemo, useState } from 'react';
import type { Assignment, UniformItem } from '../types';
import './ActiveLoaners.css';

interface ActiveLoanersProps {
  assignments: Record<string, Assignment>;
  inventory: Record<string, UniformItem>;
  studioName?: string;
}

export function ActiveLoaners({ assignments, inventory, studioName }: ActiveLoanersProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'gp' | 'date' | 'item'>('date');

  const active = useMemo(() => {
    return Object.entries(assignments)
      .filter(([, a]) => a.status === 'active')
      .map(([key, a]) => ({ key, ...a }))
      .filter(a =>
        !search ||
        a.gpName?.toLowerCase().includes(search.toLowerCase()) ||
        a.itemName?.toLowerCase().includes(search.toLowerCase()) ||
        a.itemBarcode?.includes(search)
      )
      .sort((a, b) => {
        if (sortBy === 'gp') return a.gpName.localeCompare(b.gpName);
        if (sortBy === 'item') return a.itemName.localeCompare(b.itemName);
        return new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime();
      });
  }, [assignments, search, sortBy]);

  const daysSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  return (
    <div className="active-loaners card">
      <div className="loaners-header">
        <h2 className="text-accent">
          🔄 Active Loaners
          <span className="loaner-count">{active.length}</span>
        </h2>
        {studioName && <span className="text-muted" style={{ fontSize: '0.85rem' }}>{studioName}</span>}
      </div>

      <div className="loaners-controls">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by GP, item or barcode..."
          className="input-dark"
          style={{ flex: 1 }}
        />
        <div className="sort-tabs">
          {(['date', 'gp', 'item'] as const).map(s => (
            <button key={s} className={`sort-tab ${sortBy === s ? 'active' : ''}`} onClick={() => setSortBy(s)}>
              {s === 'date' ? 'Newest' : s === 'gp' ? 'By GP' : 'By Item'}
            </button>
          ))}
        </div>
      </div>

      {active.length === 0 ? (
        <div className="empty-inline">
          {search ? `No active loaners matching "${search}"` : 'No items currently issued out.'}
        </div>
      ) : (
        <div className="loaners-table-wrap">
          <table className="table-dark loaners-table">
            <thead>
              <tr>
                <th>Game Presenter</th>
                <th>GP ID</th>
                <th>Item</th>
                <th>Size</th>
                <th>Barcode</th>
                <th>Studio</th>
                <th>Issued</th>
              </tr>
            </thead>
            <tbody>
              {active.map(a => (
                <tr key={a.key}>
                  <td>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{a.gpName}</strong>
                  </td>
                  <td>
                    {a.gpBarcode ? <code className="barcode small">{a.gpBarcode}</code> : <span className="text-muted">—</span>}
                  </td>
                  <td>{a.itemName}</td>
                  <td>{a.itemSize}</td>
                  <td><code className="barcode small">{a.itemBarcode}</code></td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{a.studio}</td>
                  <td>
                    <div style={{ fontSize: '0.8rem' }}>
                      <div style={{ color: 'var(--color-text-primary)' }}>{new Date(a.issuedAt).toLocaleDateString()}</div>
                      <div style={{ color: 'var(--color-text-muted)' }}>{daysSince(a.issuedAt)}</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
