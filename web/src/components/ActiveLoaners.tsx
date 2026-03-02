import { useMemo, useState } from 'react';
import { ref, update, push, get } from 'firebase/database';
import { db } from '../firebase';
import type { Assignment, UniformItem } from '../types';
import './ActiveLoaners.css';

interface ActiveLoanersProps {
  assignments: Record<string, Assignment>;
  inventory: Record<string, UniformItem>;
  studioName?: string;
  cityKey?: string;
  cityName?: string;
  studios?: Record<string, any>;
  laundryEnabled?: boolean;
  onRefresh?: () => void;
  currentUser?: string;
}

type ModalStep = 'confirm-barcode' | 'condition';

interface PendingReturn {
  assignmentKey: string;
  assignment: Assignment & { key: string };
  inventoryKey: string;
  item: UniformItem;
}

export function ActiveLoaners({
  assignments, inventory, studioName, cityKey, cityName,
  laundryEnabled = true, onRefresh, currentUser,
}: ActiveLoanersProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'gp' | 'date' | 'item'>('date');

  // Modal state
  const [pending, setPending]           = useState<PendingReturn | null>(null);
  const [modalStep, setModalStep]       = useState<ModalStep>('confirm-barcode');
  const [disposition, setDisposition]   = useState<'cleaner' | 'unwearable' | null>(null);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnMsg, setReturnMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const active = useMemo(() => {
    return Object.entries(assignments)
      .filter(([, a]) => a.status === 'active' && a.issueReason === 'loaner')
      .map(([key, a]) => ({ key, ...a }))
      .filter(a =>
        !search ||
        a.gpName?.toLowerCase().includes(search.toLowerCase()) ||
        a.itemName?.toLowerCase().includes(search.toLowerCase()) ||
        a.itemBarcode?.includes(search)
      )
      .sort((a, b) => {
        if (sortBy === 'gp')   return (a.gpName || '').localeCompare(b.gpName || '');
        if (sortBy === 'item') return (a.itemName || '').localeCompare(b.itemName || '');
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

  const openReturn = (a: Assignment & { key: string }) => {
    const invEntry = Object.entries(inventory).find(([, item]) => item.barcode === a.itemBarcode);
    if (!invEntry) {
      alert(`Barcode ${a.itemBarcode} not found in inventory.`);
      return;
    }
    const [invKey, invItem] = invEntry;
    setPending({ assignmentKey: a.key, assignment: a, inventoryKey: invKey, item: invItem });
    setModalStep('confirm-barcode');
    setDisposition(null);
    setReturnMsg(null);
  };

  const closeModal = () => {
    setPending(null);
    setDisposition(null);
    setReturnMsg(null);
    setReturnLoading(false);
  };

  const handleConfirmReturn = async () => {
    if (!pending || !disposition || !cityKey) return;
    setReturnLoading(true);
    setReturnMsg(null);
    try {
      const { assignment, inventoryKey, item } = pending;
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      const returnStudioKey  = assignment.issuedAtStudio || '';
      const returnStudioName = studioName || assignment.studio || '';

      if (disposition === 'cleaner') {
        const newStatus = laundryEnabled ? 'In Hamper' : 'Available';
        updates[`inventory/${cityKey}/${inventoryKey}/status`]           = newStatus;
        updates[`inventory/${cityKey}/${inventoryKey}/returnedAt`]       = timestamp;
        updates[`inventory/${cityKey}/${inventoryKey}/returnedAtStudio`] = returnStudioKey;
        updates[`inventory/${cityKey}/${inventoryKey}/returnedBy`]       = currentUser || 'Unknown User';
        updates[`inventory/${cityKey}/${inventoryKey}/studioLocation`]   = returnStudioName;
        if (!laundryEnabled) {
          updates[`inventory/${cityKey}/${inventoryKey}/issuedAt`]       = null;
          updates[`inventory/${cityKey}/${inventoryKey}/issuedAtStudio`] = null;
          updates[`inventory/${cityKey}/${inventoryKey}/issuedBy`]       = null;
        } else if (returnStudioKey) {
          const snap = await get(ref(db, `cities/${cityKey}/studios/${returnStudioKey}/currentHamperCount`));
          const cnt = snap.val() || 0;
          updates[`cities/${cityKey}/studios/${returnStudioKey}/currentHamperCount`] = cnt + 1;
        }
      } else {
        updates[`inventory/${cityKey}/${inventoryKey}/status`] = 'Damaged';
        const damageKey = push(ref(db, `damages/${cityKey}`)).key;
        updates[`damages/${cityKey}/${damageKey}`] = {
          itemBarcode: item.barcode, itemName: item.name, damageType: 'damaged',
          reportedAt: timestamp, notes: 'Returned unwearable (loaner)',
          city: cityName || '', studio: returnStudioName,
          returnedBy: currentUser || 'Unknown User',
        };
      }

      // Close all active assignments for this item
      const snap = await get(ref(db, `assignments/${cityKey}`));
      const cityAssignments = snap.val() || {};
      for (const [aKey, a] of Object.entries(cityAssignments) as [string, any][]) {
        if (a.itemBarcode === item.barcode && a.status === 'active') {
          updates[`assignments/${cityKey}/${aKey}/returnedAt`]       = timestamp;
          updates[`assignments/${cityKey}/${aKey}/returnedAtStudio`] = returnStudioKey;
          updates[`assignments/${cityKey}/${aKey}/returnedBy`]       = currentUser || 'Unknown User';
          updates[`assignments/${cityKey}/${aKey}/status`]           = 'returned';
        }
      }

      // Log
      if (returnStudioKey) {
        const logKey = push(ref(db, `logs/${cityKey}/${returnStudioKey}`)).key;
        updates[`logs/${cityKey}/${returnStudioKey}/${logKey}`] = {
          date: timestamp, action: 'LOANER_RETURN',
          details: `Loaner return — ${assignment.gpName} returned ${item.name} (${item.barcode}) — ${disposition === 'cleaner' ? (laundryEnabled ? 'sent to cleaner' : 'returned Available') : 'Damaged'}`,
        };
      }

      await update(ref(db), updates);
      setReturnMsg({ type: 'success', text: `✓ Loaner returned for ${assignment.gpName}` });
      setTimeout(() => { closeModal(); if (onRefresh) onRefresh(); }, 1500);
    } catch (err) {
      console.error(err);
      setReturnMsg({ type: 'error', text: 'Return failed. Please try again.' });
    } finally {
      setReturnLoading(false);
    }
  };

  const canReturn = !!cityKey; // only show button when city context is available

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
          {search ? `No active loaners matching "${search}"` : 'No items currently on loan.'}
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
                {canReturn && <th></th>}
              </tr>
            </thead>
            <tbody>
              {active.map(a => (
                <tr key={a.key}>
                  <td><strong style={{ color: 'var(--color-text-primary)' }}>{a.gpName}</strong></td>
                  <td>
                    {a.gpBarcode
                      ? <code className="barcode small">{a.gpBarcode}</code>
                      : <span className="text-muted">—</span>}
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
                  {canReturn && (
                    <td>
                      <button className="btn-return-loaner" onClick={() => openReturn(a)}>
                        Return
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── RETURN MODAL ─────────────────────────────────────────── */}
      {pending && (
        <div className="loaner-modal-overlay" onClick={e => { if (e.target === e.currentTarget && !returnLoading) closeModal(); }}>
          <div className="loaner-modal">

            {returnMsg && (
              <div className={`alert alert-${returnMsg.type}`} style={{ marginBottom: '1rem' }}>
                {returnMsg.text}
              </div>
            )}

            {/* STEP 1 — Confirm barcode */}
            {modalStep === 'confirm-barcode' && (
              <>
                <h3 className="modal-title">Return Loaner</h3>
                <p className="modal-subtitle">
                  Returning item for <strong>{pending.assignment.gpName}</strong>
                </p>

                <div className="modal-item-card">
                  <div className="modal-item-name">{pending.item.name} — {pending.item.size}</div>
                  <div className="modal-barcode-row">
                    <span className="modal-barcode-label">Barcode</span>
                    <code className="barcode">{pending.item.barcode}</code>
                  </div>
                  <div className="modal-item-meta">
                    Issued {new Date(pending.assignment.issuedAt).toLocaleDateString()} · {daysSince(pending.assignment.issuedAt)}
                  </div>
                </div>

                <p className="modal-question">
                  Is <strong>{pending.item.barcode}</strong> the correct barcode for this item?
                </p>

                <div className="modal-btn-row">
                  <button className="btn btn-gold" onClick={() => setModalStep('condition')}>
                    ✓ Yes, correct
                  </button>
                  <button className="btn btn-dark" onClick={closeModal}>
                    ✕ No, cancel
                  </button>
                </div>
              </>
            )}

            {/* STEP 2 — Condition */}
            {modalStep === 'condition' && (
              <>
                <h3 className="modal-title">Item Condition</h3>
                <p className="modal-subtitle">
                  <strong>{pending.item.name}</strong> &nbsp;·&nbsp;
                  <code className="barcode small">{pending.item.barcode}</code>
                </p>

                <div className="modal-disposition-row">
                  <button
                    className={`disposition-btn ${disposition === 'cleaner' ? 'selected-cleaner' : ''}`}
                    onClick={() => setDisposition('cleaner')}
                  >
                    {laundryEnabled ? '🧺 Send to Cleaner' : '✅ Return to Available'}
                  </button>
                  <button
                    className={`disposition-btn ${disposition === 'unwearable' ? 'selected-damage' : ''}`}
                    onClick={() => setDisposition('unwearable')}
                  >
                    ⚠️ Unwearable / Damaged
                  </button>
                </div>

                <div className="modal-btn-row" style={{ marginTop: '1.25rem' }}>
                  <button
                    className="btn btn-gold"
                    onClick={handleConfirmReturn}
                    disabled={!disposition || returnLoading}
                  >
                    {returnLoading ? 'Processing…' : '✓ Confirm Return'}
                  </button>
                  <button
                    className="btn btn-dark"
                    onClick={() => setModalStep('confirm-barcode')}
                    disabled={returnLoading}
                  >
                    ← Back
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
