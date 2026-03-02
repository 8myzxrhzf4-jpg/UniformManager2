import { useState, useRef } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import type { UniformItem, GamePresenter, Assignment } from '../types';
import './GPLookup.css';

interface GPLookupProps {
  cityKey: string;
  cityName: string;
  inventory: Record<string, UniformItem>;
  gps: Record<string, GamePresenter>;
}

interface LookupResult {
  gp: GamePresenter & { key: string };
  activeAssignments: (Assignment & { key: string })[];
  issuedItems: (UniformItem & { key: string })[];
}

export function GPLookup({ cityKey, cityName, inventory, gps }: GPLookupProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLookup = async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q) return;

    setLoading(true);
    setResult(null);
    setNotFound(false);

    try {
      // Find GP by barcode (ID card) or name
      const gpEntry = Object.entries(gps).find(([_, gp]) =>
        gp.barcode === q || gp.name.toLowerCase() === q.toLowerCase()
      );

      if (!gpEntry) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const [gpKey, gp] = gpEntry;

      // Get active assignments for this GP
      const assignmentsSnapshot = await get(ref(db, `assignments/${cityKey}`));
      const assignments = assignmentsSnapshot.val() || {};

      const activeAssignments = Object.entries(assignments)
        .filter(([_, a]: [string, any]) => a.gpBarcode === gp.barcode && a.status === 'active')
        .map(([key, a]: [string, any]) => ({ key, ...a }));

      // Find corresponding inventory items
      const issuedItems = activeAssignments
        .map(assignment => {
          const itemEntry = Object.entries(inventory).find(([_, item]) => item.barcode === assignment.itemBarcode);
          return itemEntry ? { key: itemEntry[0], ...itemEntry[1] } : null;
        })
        .filter(Boolean) as (UniformItem & { key: string })[];

      setResult({ gp: { key: gpKey, ...gp }, activeAssignments, issuedItems });
    } catch (err) {
      console.error('GP lookup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!result) return;
    const rows = [
      ['GP Name', 'GP ID Card', 'Item', 'Size', 'Barcode', 'Issued At', 'Studio', 'Issue Reason', 'Status'],
      ...result.activeAssignments.map(a => {
        const item = result.issuedItems.find(i => i.barcode === a.itemBarcode);
        return [
          a.gpName, a.gpBarcode || '',
          a.itemName, a.itemSize, a.itemBarcode,
          a.issuedAt ? new Date(a.issuedAt).toLocaleString() : '',
          a.studio || '',
          a.issueReasonLabel || a.issueReason || '',
          item?.status || 'Issued',
        ];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gp-lookup-${result.gp.barcode || result.gp.name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setQuery('');
    setResult(null);
    setNotFound(false);
    inputRef.current?.focus();
  };

  return (
    <div className="gp-lookup-container card">
      <h2 className="text-accent">GP Uniform Lookup</h2>
      <p className="text-muted">Scan or enter a GP ID card to view their issued uniforms</p>

      <div className="lookup-search-row">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleLookup(); }}
          placeholder="Scan or enter GP ID card number or name"
          className="input-dark lookup-input"
          disabled={loading}
          autoFocus
        />
        <button onClick={() => handleLookup()} disabled={loading || !query.trim()} className="btn btn-gold">
          {loading ? 'Looking up...' : 'Look Up'}
        </button>
        {(result || notFound) && (
          <button onClick={handleClear} className="btn btn-secondary">Clear</button>
        )}
      </div>

      {notFound && (
        <div className="alert alert-error">
          No GP found with ID card or name "{query}". Check the ID and try again.
        </div>
      )}

      {result && (
        <div className="lookup-result">
          <div className="gp-profile">
            <div className="gp-profile-info">
              <h3 className="gp-name">{result.gp.name}</h3>
              <span className="gp-id">ID Card: {result.gp.barcode || 'N/A'}</span>
              {result.gp.city && <span className="gp-city">{result.gp.city}</span>}
            </div>
            <div className="gp-stats">
              <div className="gp-stat">
                <span className="gp-stat-value">{result.activeAssignments.length}</span>
                <span className="gp-stat-label">Items Issued</span>
              </div>
            </div>
          </div>

          {result.activeAssignments.length === 0 ? (
            <div className="no-items-message">
              <p className="text-muted">No uniforms currently issued to this GP.</p>
            </div>
          ) : (
            <>
              <div className="lookup-items-header">
                <h4>Currently Issued Uniforms</h4>
                <button onClick={exportCSV} className="btn btn-small btn-secondary">Export CSV</button>
              </div>
              <div className="lookup-items-list">
                {result.activeAssignments.map(assignment => {
                  const item = result.issuedItems.find(i => i.barcode === assignment.itemBarcode);
                  const daysOut = assignment.issuedAt
                    ? Math.floor((Date.now() - new Date(assignment.issuedAt).getTime()) / 86400000)
                    : null;
                  return (
                    <div key={assignment.key} className="lookup-item-card">
                      <div className="lookup-item-main">
                        <span className="lookup-item-name">{assignment.itemName}</span>
                        <span className="lookup-item-size">{assignment.itemSize}</span>
                        <span className="lookup-item-barcode">{assignment.itemBarcode}</span>
                      </div>
                      <div className="lookup-item-meta">
                        {assignment.issueReasonLabel && (
                          <span className="lookup-reason-badge">{assignment.issueReasonLabel}</span>
                        )}
                        {assignment.studio && (
                          <span className="lookup-studio">{assignment.studio}</span>
                        )}
                        {daysOut !== null && (
                          <span className={`lookup-days ${daysOut >= 30 ? 'overdue' : ''}`}>
                            {daysOut === 0 ? 'Issued today' : `${daysOut} day${daysOut !== 1 ? 's' : ''} ago`}
                          </span>
                        )}
                        <span className={`status-badge status-${(item?.status || 'issued').toLowerCase().replace(/\s+/g, '-')}`}>
                          {item?.status || 'Issued'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

