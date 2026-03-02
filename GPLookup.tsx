import { useState, useMemo } from 'react';
import type { GamePresenter, Assignment } from '../types';
import './GPLookup.css';

interface GPLookupProps {
  gps: Record<string, GamePresenter>;
  // All assignments across all cities: { cityKey: { assignmentKey: Assignment } }
  allAssignments: Record<string, Record<string, Assignment>>;
  cities: Record<string, { name: string }>;
}

export function GPLookup({ gps, allAssignments, cities }: GPLookupProps) {
  const [search, setSearch] = useState('');
  const [selectedGP, setSelectedGP] = useState<{ key: string; gp: GamePresenter } | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'returned'>('all');

  // Flatten all GPs from all cities
  const allGPs = useMemo(() => {
    const list: Array<{ key: string; gp: GamePresenter; cityKey: string }> = [];
    // gps may be nested by city or flat
    Object.entries(gps).forEach(([k, v]) => {
      if (v && typeof v === 'object' && 'name' in v) {
        list.push({ key: k, gp: v as GamePresenter, cityKey: '' });
      } else {
        // nested by city
        Object.entries(v as Record<string, GamePresenter>).forEach(([gpKey, gpVal]) => {
          list.push({ key: gpKey, gp: gpVal, cityKey: k });
        });
      }
    });
    return list;
  }, [gps]);

  const filteredGPs = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allGPs.filter(
      ({ gp }) =>
        gp.name?.toLowerCase().includes(q) ||
        (gp.barcode || '').toLowerCase().includes(q)
    ).slice(0, 10);
  }, [search, allGPs]);

  // All assignments for selected GP
  const gpAssignments = useMemo(() => {
    if (!selectedGP) return [];
    const results: Array<Assignment & { cityKey: string; assignmentKey: string }> = [];
    Object.entries(allAssignments).forEach(([cityKey, cityAssignments]) => {
      Object.entries(cityAssignments || {}).forEach(([aKey, a]) => {
        if (
          a.gpName === selectedGP.gp.name ||
          (selectedGP.gp.barcode && a.gpBarcode === selectedGP.gp.barcode)
        ) {
          results.push({ ...a, cityKey, assignmentKey: aKey });
        }
      });
    });
    return results.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  }, [selectedGP, allAssignments]);

  const filtered = useMemo(() => {
    if (filter === 'active') return gpAssignments.filter(a => a.status === 'active');
    if (filter === 'returned') return gpAssignments.filter(a => a.status === 'returned');
    return gpAssignments;
  }, [gpAssignments, filter]);

  const activeCount = gpAssignments.filter(a => a.status === 'active').length;

  return (
    <div className="gp-lookup card">
      <h2 className="text-accent">🔍 GP Lookup</h2>
      <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
        Search for a Game Presenter to view all items they have been issued.
      </p>

      <div className="gp-search-row">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); if (!e.target.value) setSelectedGP(null); }}
          placeholder="Search GP name or ID card..."
          className="input-dark gp-search-input"
          autoFocus
        />
      </div>

      {/* Suggestions */}
      {search && !selectedGP && filteredGPs.length > 0 && (
        <div className="gp-suggestion-list">
          {filteredGPs.map(({ key, gp, cityKey }) => (
            <button
              key={key}
              className="gp-suggestion-row"
              onClick={() => { setSelectedGP({ key, gp }); setSearch(gp.name); }}
            >
              <span className="gp-sug-name">{gp.name}</span>
              <span className="gp-sug-meta">
                {gp.barcode && <span className="barcode small">{gp.barcode}</span>}
                {(gp.city || cities[cityKey]?.name) && (
                  <span>{gp.city || cities[cityKey]?.name}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {search && !selectedGP && filteredGPs.length === 0 && (
        <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>No GPs found matching "{search}"</p>
      )}

      {/* GP Detail */}
      {selectedGP && (
        <div className="gp-detail">
          <div className="gp-detail-header">
            <div>
              <h3>{selectedGP.gp.name}</h3>
              {selectedGP.gp.barcode && <code className="barcode">{selectedGP.gp.barcode}</code>}
              {selectedGP.gp.city && <span className="text-muted" style={{ marginLeft: '0.75rem', fontSize: '0.85rem' }}>{selectedGP.gp.city}{selectedGP.gp.studio ? ` · ${selectedGP.gp.studio}` : ''}</span>}
            </div>
            <div className="gp-stats">
              <div className="gp-stat">
                <span className="gp-stat-num">{gpAssignments.length}</span>
                <span className="gp-stat-label">Total Issues</span>
              </div>
              <div className="gp-stat">
                <span className="gp-stat-num" style={{ color: activeCount > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  {activeCount}
                </span>
                <span className="gp-stat-label">Currently Out</span>
              </div>
            </div>
          </div>

          {gpAssignments.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.875rem', fontStyle: 'italic' }}>No assignment history found for this GP.</p>
          ) : (
            <>
              <div className="gp-filter-tabs">
                {(['all', 'active', 'returned'] as const).map(f => (
                  <button
                    key={f}
                    className={`gp-filter-tab ${filter === f ? 'active' : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? `All (${gpAssignments.length})` : f === 'active' ? `Active (${gpAssignments.filter(a => a.status === 'active').length})` : `Returned (${gpAssignments.filter(a => a.status === 'returned').length})`}
                  </button>
                ))}
              </div>

              <div className="assignment-table-wrap">
                <table className="table-dark assignment-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Size</th>
                      <th>Barcode</th>
                      <th>Studio</th>
                      <th>Issued</th>
                      <th>Returned</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => (
                      <tr key={a.assignmentKey}>
                        <td>{a.itemName}</td>
                        <td>{a.itemSize}</td>
                        <td><code className="barcode small">{a.itemBarcode}</code></td>
                        <td style={{ fontSize: '0.8rem' }}>{a.studio}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          {new Date(a.issuedAt).toLocaleDateString()}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          {a.returnedAt ? new Date(a.returnedAt).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          <span className={`status-badge status-${a.status === 'active' ? 'issued' : 'available'}`}>
                            {a.status === 'active' ? 'Out' : 'Returned'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <button className="btn btn-dark btn-sm" style={{ marginTop: '1rem' }} onClick={() => { setSelectedGP(null); setSearch(''); }}>
            ← Clear
          </button>
        </div>
      )}
    </div>
  );
}
