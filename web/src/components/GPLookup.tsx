import { useState, useMemo, useRef } from 'react';
import type { GamePresenter, Assignment, City } from '../types';
import './GPLookup.css';

interface GPLookupProps {
  gps: Record<string, GamePresenter>;
  allAssignments: Record<string, Record<string, Assignment>>;
  cities: Record<string, City>;
  cityKey?: string;     // when set, scopes search to this city only
  onBack?: () => void;  // back button callback
}

interface GPResult {
  name: string;
  barcode?: string;
  history: (Assignment & { key: string; cityKey: string })[];
}

export function GPLookup({ gps, allAssignments, cities, cityKey, onBack }: GPLookupProps) {
  const [query, setQuery] = useState('');
  const [selectedGP, setSelectedGP] = useState<GPResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'returned'>('all');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cityName = cityKey ? cities[cityKey]?.name : undefined;

  // Flatten GPs — scoped to cityKey when provided
  const allGPList = useMemo(() => {
    const seen = new Map<string, GamePresenter & { key: string }>();
    const add = (key: string, gp: any) => {
      const gpName = gp?.name;
      if (gpName && typeof gpName === 'string' && !seen.has(gpName.toLowerCase())) {
        seen.set(gpName.toLowerCase(), { key, ...gp });
      }
    };
    if (cityKey) {
      // Only look at GPs in the selected city
      const cityGPs = (gps as any)[cityKey];
      if (cityGPs && typeof cityGPs === 'object') {
        Object.entries(cityGPs).forEach(([k, v]) => add(k, v));
      }
    } else {
      Object.entries(gps).forEach(([k, v]: [string, any]) => {
        if (v && typeof v === 'object') {
          if ('name' in v) add(k, v);
          else Object.entries(v).forEach(([subk, subv]) => add(subk, subv));
        }
      });
    }
    return Array.from(seen.values())
      .filter(gp => gp.name && typeof gp.name === 'string')
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [gps, cityKey]);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allGPList
      .filter(gp => (gp.name || '').toLowerCase().includes(q) || (gp.barcode || '').includes(q))
      .slice(0, 8);
  }, [query, allGPList]);

  const lookupGP = (gp: GamePresenter & { key: string }) => {
    const history: (Assignment & { key: string; cityKey: string })[] = [];
    // Scope assignment search to cityKey if provided
    const scope = cityKey
      ? { [cityKey]: allAssignments[cityKey] || {} }
      : allAssignments;
    Object.entries(scope).forEach(([ck, cityAssignments]) => {
      Object.entries(cityAssignments || {}).forEach(([aKey, a]) => {
        const matchName = a.gpName?.toLowerCase() === (gp.name || '').toLowerCase();
        const matchBarcode = gp.barcode && a.gpBarcode === gp.barcode;
        if (matchName || matchBarcode) {
          history.push({ ...a, key: aKey, cityKey: ck });
        }
      });
    });
    history.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
    setSelectedGP({ name: gp.name, barcode: gp.barcode, history });
    setQuery(gp.name);
    setShowDropdown(false);
  };

  const visibleHistory = useMemo(() => {
    if (!selectedGP) return [];
    if (filter === 'active') return selectedGP.history.filter(a => a.status === 'active');
    if (filter === 'returned') return selectedGP.history.filter(a => a.status === 'returned');
    return selectedGP.history;
  }, [selectedGP, filter]);

  const activeCount = selectedGP?.history.filter(a => a.status === 'active').length ?? 0;
  const totalCount = selectedGP?.history.length ?? 0;

  const exportCSV = () => {
    if (!selectedGP) return;
    const rows = [
      ['GP Name', 'GP ID', 'Item', 'Size', 'Barcode', 'Studio', 'City', 'Issued', 'Issued By', 'Returned', 'Returned By', 'Status'],
      ...selectedGP.history.map(a => [
        a.gpName, a.gpBarcode || '',
        a.itemName, a.itemSize, a.itemBarcode,
        a.studio || '', a.city || '',
        a.issuedAt ? new Date(a.issuedAt).toLocaleDateString() : '',
        a.issuedBy || '',
        a.returnedAt ? new Date(a.returnedAt).toLocaleDateString() : '',
        a.returnedBy || '',
        a.status,
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gp-lookup-${selectedGP.name.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="gp-lookup card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        {onBack && (
          <button
            onClick={onBack}
            className="btn btn-dark"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
          >
            ← Back
          </button>
        )}
        <h2 className="text-accent" style={{ margin: 0 }}>🔍 GP Lookup</h2>
        {cityName && (
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
            Scoped to {cityName}
          </span>
        )}
      </div>
      <p className="text-muted" style={{ marginBottom: '1.25rem', fontSize: '0.875rem' }}>
        {cityKey
          ? `Search Game Presenters in ${cityName || cityKey}.`
          : 'Search for any Game Presenter across all cities to view their full assignment history.'}
      </p>

      <div className="gp-search-row">
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedGP(null); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search GP name or ID card..."
            className="input-dark gp-search-input"
            autoFocus
          />
          {showDropdown && filtered.length > 0 && (
            <div className="gp-suggestion-list">
              {filtered.map(gp => (
                <button key={gp.key} className="gp-suggestion-row" onClick={() => lookupGP(gp)}>
                  <span className="gp-sug-name">{gp.name}</span>
                  <span className="gp-sug-meta">
                    {gp.barcode && <code>{gp.barcode}</code>}
                    {gp.city && <span>{gp.city}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedGP && (
          <button className="btn btn-dark" onClick={() => { setSelectedGP(null); setQuery(''); inputRef.current?.focus(); }}>
            Clear
          </button>
        )}
      </div>

      {selectedGP && (
        <div className="gp-detail">
          <div className="gp-detail-header">
            <div>
              <h3>{selectedGP.name}</h3>
              {selectedGP.barcode && <code className="barcode small">{selectedGP.barcode}</code>}
            </div>
            <div className="gp-stats">
              <div className="gp-stat">
                <span className="gp-stat-num">{totalCount}</span>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div className="gp-filter-tabs">
              {(['all', 'active', 'returned'] as const).map(f => (
                <button key={f} className={`gp-filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Returned'}
                </button>
              ))}
            </div>
            {totalCount > 0 && (
              <button className="btn btn-dark" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={exportCSV}>
                Export CSV
              </button>
            )}
          </div>

          {visibleHistory.length === 0 ? (
            <div className="empty-inline">No records found.</div>
          ) : (
            <div className="assignment-table-wrap">
              <table className="table-dark assignment-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Size</th>
                    <th>Barcode</th>
                    <th>Studio</th>
                    <th>City</th>
                    <th>Issued</th>
                    <th>Returned</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHistory.map(a => (
                    <tr key={`${a.cityKey}-${a.key}`}>
                      <td>{a.itemName}</td>
                      <td>{a.itemSize}</td>
                      <td><code className="barcode small">{a.itemBarcode}</code></td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{a.studio}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{a.city}</td>
                      <td style={{ fontSize: '0.8rem' }}>{a.issuedAt ? new Date(a.issuedAt).toLocaleDateString() : '—'}</td>
                      <td style={{ fontSize: '0.8rem' }}>{a.returnedAt ? new Date(a.returnedAt).toLocaleDateString() : '—'}</td>
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
          )}
        </div>
      )}

      {!selectedGP && query.trim() && filtered.length === 0 && (
        <div className="empty-inline" style={{ marginTop: '0.75rem' }}>
          No GP found matching "{query}". Check the name or ID card number.
        </div>
      )}

      {!query.trim() && (
        <div className="empty-inline" style={{ marginTop: '0.75rem' }}>
          Start typing to search for a Game Presenter.
        </div>
      )}
    </div>
  );
}
