import { useState } from 'react';
import { ref, update, push, get } from 'firebase/database';
import { db } from '../firebase';
import type { UniformItem, GamePresenter, Studio } from '../types';
import './Operations.css';

const CURRENT_USER = 'web-user';

const ISSUE_REASONS = [
  { value: 'new_hire', label: 'New Hire' },
  { value: 'size_change', label: 'Size Change' },
  { value: 'replacement_damaged', label: 'Replacement - Damaged' },
  { value: 'replacement_lost', label: 'Replacement - Lost' },
  { value: 'learned_new_game', label: 'Learned New Game' },
  { value: 'schedule_group_change', label: 'Schedule / Group Change' },
  { value: 'loaner', label: 'Loaner' },
  { value: 'two_year_exchange', label: '2 Year Exchange' },
];

const LOANER_REASONS = [
  { value: 'forgot', label: 'Forgot' },
  { value: 'scheduled_different_pit', label: 'Scheduled for Different Pit' },
  { value: 'spill_dirty', label: 'Spill / Dirty' },
];

const RETURN_CONDITIONS = [
  { value: 'intact', label: 'Intact', action: 'laundry' as const },
  { value: 'stained', label: 'Stained', action: 'laundry' as const },
  { value: 'ripped', label: 'Ripped', action: 'destroy' as const },
  { value: 'zipper_clasp_broken', label: 'Zipper / Clasp Broken', action: 'destroy' as const },
  { value: 'missing_button', label: 'Missing Button', action: 'destroy' as const },
  { value: 'fabric_issue', label: 'Fabric Issue', action: 'destroy' as const },
  { value: 'item_retired', label: 'Item Retired', action: 'destroy' as const },
];

const clearTrackingFields = (prefix: string) => ({
  [`${prefix}/issuedAt`]: null,
  [`${prefix}/issuedAtStudio`]: null,
  [`${prefix}/issuedAtCity`]: null,
  [`${prefix}/issuedBy`]: null,
  [`${prefix}/returnedAt`]: null,
  [`${prefix}/returnedAtStudio`]: null,
  [`${prefix}/returnedBy`]: null,
  [`${prefix}/issueReason`]: null,
  [`${prefix}/loanerReason`]: null,
});

interface OperationsProps {
  cityKey: string;
  cityName: string;
  studioKey: string;
  studioName: string;
  inventory: Record<string, UniformItem>;
  gps: Record<string, GamePresenter>;
  studios?: Record<string, Studio>;
  onRefresh?: () => void;
}

export function Operations({ cityKey, cityName, studioKey, studioName, inventory, gps, studios = {}, onRefresh }: OperationsProps) {
  const [activeTab, setActiveTab] = useState<'issue' | 'return' | 'laundry' | 'loaners' | 'damage'>('issue');

  const tabs = [
    { id: 'issue', label: 'Issue' },
    { id: 'return', label: 'Return' },
    { id: 'laundry', label: 'Laundry' },
    { id: 'loaners', label: 'Active Loaners' },
    { id: 'damage', label: 'Damage/Lost' },
  ] as const;

  return (
    <div className="operations-container card">
      <h2 className="text-accent">Operations</h2>
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {activeTab === 'issue' && <IssueOperation cityKey={cityKey} cityName={cityName} studioKey={studioKey} studioName={studioName} inventory={inventory} gps={gps} studios={studios} onRefresh={onRefresh} />}
        {activeTab === 'return' && <ReturnOperation cityKey={cityKey} cityName={cityName} studioKey={studioKey} studioName={studioName} inventory={inventory} studios={studios} onRefresh={onRefresh} />}
        {activeTab === 'laundry' && <LaundryOperation cityKey={cityKey} cityName={cityName} studioKey={studioKey} studioName={studioName} inventory={inventory} onRefresh={onRefresh} />}
        {activeTab === 'loaners' && <ActiveLoaners cityKey={cityKey} cityName={cityName} studioKey={studioKey} studioName={studioName} inventory={inventory} studios={studios} onRefresh={onRefresh} />}
        {activeTab === 'damage' && <DamageOperation cityKey={cityKey} cityName={cityName} studioKey={studioKey} studioName={studioName} inventory={inventory} onRefresh={onRefresh} />}
      </div>
    </div>
  );
}

interface OperationComponentProps {
  cityKey: string;
  cityName: string;
  studioKey: string;
  studioName: string;
  inventory: Record<string, UniformItem>;
  gps?: Record<string, GamePresenter>;
  studios?: Record<string, Studio>;
  onRefresh?: () => void;
}

// ─── ISSUE ─────────────────────────────────────────────────────────────────

function IssueOperation({ cityKey, cityName, studioKey, studioName, inventory, gps, studios = {}, onRefresh }: OperationComponentProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedGP, setSelectedGP] = useState('');
  const [newGPName, setNewGPName] = useState('');
  const [newGPIdCard, setNewGPIdCard] = useState('');
  const [targetStudioKey, setTargetStudioKey] = useState(studioKey);
  const [issueReason, setIssueReason] = useState('');
  const [loanerReason, setLoanerReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const studioList = Object.entries(studios).map(([key, studio]) => ({ key, name: studio.name }));
  const gpList = gps ? Object.entries(gps).map(([key, gp]) => ({ key, ...gp })) : [];
  const targetStudioName = studioList.find(s => s.key === targetStudioKey)?.name || studioName;

  const availableItems = Object.entries(inventory).filter(
    ([_, item]) => (item.status === 'Available' || item.status === 'In Stock') && item.studioLocation === targetStudioName
  );

  const handleIssue = async () => {
    if (selectedItems.length === 0) { setMessage({ type: 'error', text: 'Please select at least one item' }); return; }
    if (!selectedGP) { setMessage({ type: 'error', text: 'Please select a GP' }); return; }
    if (!issueReason) { setMessage({ type: 'error', text: 'Please select an issue reason' }); return; }
    if (issueReason === 'loaner' && !loanerReason) { setMessage({ type: 'error', text: 'Please select a loaner reason' }); return; }

    const gpName = selectedGP === 'new' ? newGPName.trim() : gpList.find(gp => gp.key === selectedGP)?.name || '';
    const gpIdCard = selectedGP === 'new' ? newGPIdCard.trim() : gpList.find(gp => gp.key === selectedGP)?.barcode || '';

    if (!gpName) { setMessage({ type: 'error', text: 'Please enter GP name' }); return; }
    if (selectedGP === 'new' && !newGPIdCard.trim()) { setMessage({ type: 'error', text: 'Please enter GP ID card' }); return; }

    setLoading(true);
    setMessage(null);

    try {
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      const isLoaner = issueReason === 'loaner';
      const issueReasonLabel = ISSUE_REASONS.find(r => r.value === issueReason)?.label || issueReason;
      const loanerReasonLabel = LOANER_REASONS.find(r => r.value === loanerReason)?.label || loanerReason;

      for (const itemKey of selectedItems) {
        const item = inventory[itemKey];
        updates[`inventory/${cityKey}/${itemKey}/status`] = isLoaner ? 'Loaner' : 'Issued';
        updates[`inventory/${cityKey}/${itemKey}/issuedAt`] = timestamp;
        updates[`inventory/${cityKey}/${itemKey}/issuedAtStudio`] = targetStudioKey;
        updates[`inventory/${cityKey}/${itemKey}/issuedAtCity`] = cityKey;
        updates[`inventory/${cityKey}/${itemKey}/issuedBy`] = CURRENT_USER;
        updates[`inventory/${cityKey}/${itemKey}/issueReason`] = issueReason;
        if (isLoaner) updates[`inventory/${cityKey}/${itemKey}/loanerReason`] = loanerReason;

        const assignmentKey = push(ref(db, `assignments/${cityKey}`)).key;
        updates[`assignments/${cityKey}/${assignmentKey}`] = {
          itemBarcode: item.barcode, itemName: item.name, itemSize: item.size,
          gpName, gpBarcode: gpIdCard,
          issuedAt: timestamp, issuedAtStudio: targetStudioKey, issuedAtCity: cityKey, issuedBy: CURRENT_USER,
          status: 'active', city: cityName, studio: targetStudioName,
          issueReason, issueReasonLabel,
          isLoaner,
          ...(isLoaner ? { loanerReason, loanerReasonLabel } : {}),
        };
      }

      if (selectedGP === 'new' && newGPName.trim()) {
        const gpKey = push(ref(db, `gamePresenters/${cityKey}`)).key;
        updates[`gamePresenters/${cityKey}/${gpKey}`] = { name: newGPName.trim(), barcode: newGPIdCard.trim(), city: cityName };
      }

      const logKey = push(ref(db, `logs/${cityKey}/${targetStudioKey}`)).key;
      updates[`logs/${cityKey}/${targetStudioKey}/${logKey}`] = {
        date: timestamp,
        action: isLoaner ? 'LOANER' : 'ISSUE',
        details: `${isLoaner ? 'Loaner' : 'Issued'} ${selectedItems.length} item(s) to ${gpName} — ${issueReasonLabel}${isLoaner ? ` / ${loanerReasonLabel}` : ''}`,
      };

      await update(ref(db), updates);
      setMessage({ type: 'success', text: `Successfully ${isLoaner ? 'loaned' : 'issued'} ${selectedItems.length} item(s) to ${gpName}` });
      setSelectedItems([]);
      setSelectedGP('');
      setNewGPName('');
      setNewGPIdCard('');
      setIssueReason('');
      setLoanerReason('');
      if (onRefresh) setTimeout(onRefresh, 500);
    } catch (error) {
      console.error('Issue error:', error);
      setMessage({ type: 'error', text: 'Failed to issue items. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="operation-content">
      <h3>Issue Uniforms</h3>
      <p className="text-muted">Select items to issue to a game presenter</p>
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="form-group">
        <label>Target Studio</label>
        <select value={targetStudioKey} onChange={e => { setTargetStudioKey(e.target.value); setSelectedItems([]); }} className="input-dark" disabled={loading}>
          {studioList.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label>Select Game Presenter</label>
        <select value={selectedGP} onChange={e => setSelectedGP(e.target.value)} className="input-dark" disabled={loading}>
          <option value="">-- Select GP --</option>
          {gpList.map(gp => <option key={gp.key} value={gp.key}>{gp.name} {gp.barcode ? `(${gp.barcode})` : ''}</option>)}
          <option value="new">+ Add New GP</option>
        </select>
      </div>

      {selectedGP === 'new' && (
        <>
          <div className="form-group">
            <label>New GP Name</label>
            <input type="text" value={newGPName} onChange={e => setNewGPName(e.target.value)} placeholder="Enter GP name" className="input-dark" disabled={loading} />
          </div>
          <div className="form-group">
            <label>New GP ID Card</label>
            <input type="text" value={newGPIdCard} onChange={e => setNewGPIdCard(e.target.value)} placeholder="Enter GP ID card number" className="input-dark" disabled={loading} />
          </div>
        </>
      )}

      <div className="form-group">
        <label>Issue Reason</label>
        <select value={issueReason} onChange={e => { setIssueReason(e.target.value); setLoanerReason(''); }} className="input-dark" disabled={loading}>
          <option value="">-- Select Reason --</option>
          {ISSUE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {issueReason === 'loaner' && (
        <div className="form-group">
          <label>Loaner Reason</label>
          <select value={loanerReason} onChange={e => setLoanerReason(e.target.value)} className="input-dark" disabled={loading}>
            <option value="">-- Select Loaner Reason --</option>
            {LOANER_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      )}

      <div className="form-group">
        <label>Select Items (Available at {targetStudioName})</label>
        {availableItems.length === 0 ? (
          <p className="text-muted">No items available to issue at this studio</p>
        ) : (
          <div className="item-list">
            {availableItems.map(([key, item]) => (
              <label key={key} className="item-checkbox">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(key)}
                  onChange={e => setSelectedItems(e.target.checked ? [...selectedItems, key] : selectedItems.filter(k => k !== key))}
                  disabled={loading}
                />
                <span>{item.name} - {item.size} ({item.barcode})</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <button onClick={handleIssue} disabled={loading || selectedItems.length === 0 || !selectedGP} className="btn btn-gold">
        {loading ? 'Issuing...' : `Issue ${selectedItems.length} Item(s)`}
      </button>
    </div>
  );
}

// ─── RETURN ────────────────────────────────────────────────────────────────

function ReturnOperation({ cityKey, cityName, studioKey, studioName, inventory, studios = {}, onRefresh }: OperationComponentProps) {
  const [barcode, setBarcode] = useState('');
  const [condition, setCondition] = useState('');
  const [targetStudioKey, setTargetStudioKey] = useState(studioKey);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const studioList = Object.entries(studios).map(([key, studio]) => ({ key, name: studio.name }));
  const conditionObj = RETURN_CONDITIONS.find(c => c.value === condition) || null;

  const handleReturn = async () => {
    if (!barcode.trim()) { setMessage({ type: 'error', text: 'Please enter a barcode' }); return; }
    if (!condition) { setMessage({ type: 'error', text: 'Please select the item condition' }); return; }

    setLoading(true);
    setMessage(null);

    try {
      const itemEntry = Object.entries(inventory).find(([_, item]) => item.barcode === barcode.trim());
      if (!itemEntry) { setMessage({ type: 'error', text: `Item with barcode ${barcode} not found` }); setLoading(false); return; }

      const [itemKey, item] = itemEntry;
      if (item.status !== 'Issued' && item.status !== 'Loaner') {
        setMessage({ type: 'error', text: `Item status is "${item.status}". Only Issued or Loaner items can be returned.` });
        setLoading(false);
        return;
      }

      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      const targetStudio = studioList.find(s => s.key === targetStudioKey);
      const targetStudioName = targetStudio?.name || studioName;
      const isDestroyed = conditionObj?.action === 'destroy';

      updates[`inventory/${cityKey}/${itemKey}/returnedAt`] = timestamp;
      updates[`inventory/${cityKey}/${itemKey}/returnedAtStudio`] = targetStudioKey;
      updates[`inventory/${cityKey}/${itemKey}/returnedBy`] = CURRENT_USER;
      updates[`inventory/${cityKey}/${itemKey}/returnCondition`] = condition;

      if (isDestroyed) {
        updates[`inventory/${cityKey}/${itemKey}/status`] = 'Damaged';
        // Write destroyed record for export
        const destroyedKey = push(ref(db, `destroyed/${cityKey}`)).key;
        updates[`destroyed/${cityKey}/${destroyedKey}`] = {
          itemBarcode: item.barcode, itemName: item.name, itemSize: item.size,
          condition, conditionLabel: conditionObj?.label || condition,
          destroyedAt: timestamp, destroyedBy: CURRENT_USER,
          city: cityName, studio: targetStudioName,
        };
      } else {
        // Intact or Stained — enters laundry
        updates[`inventory/${cityKey}/${itemKey}/status`] = 'In Hamper';
        updates[`inventory/${cityKey}/${itemKey}/studioLocation`] = targetStudioName;
        if (studios[targetStudioKey]) {
          const currentCount = studios[targetStudioKey].currentHamperCount || 0;
          updates[`cities/${cityKey}/studios/${targetStudioKey}/currentHamperCount`] = currentCount + 1;
        }
      }

      // Close active assignment
      const assignmentsSnapshot = await get(ref(db, `assignments/${cityKey}`));
      const assignments = assignmentsSnapshot.val() || {};
      for (const [assignmentKey, assignment] of Object.entries(assignments) as [string, any][]) {
        if (assignment.itemBarcode === item.barcode && assignment.status === 'active') {
          updates[`assignments/${cityKey}/${assignmentKey}/returnedAt`] = timestamp;
          updates[`assignments/${cityKey}/${assignmentKey}/returnedAtStudio`] = targetStudioKey;
          updates[`assignments/${cityKey}/${assignmentKey}/returnedBy`] = CURRENT_USER;
          updates[`assignments/${cityKey}/${assignmentKey}/returnCondition`] = condition;
          updates[`assignments/${cityKey}/${assignmentKey}/status`] = 'returned';
        }
      }

      const logKey = push(ref(db, `logs/${cityKey}/${targetStudioKey}`)).key;
      updates[`logs/${cityKey}/${targetStudioKey}/${logKey}`] = {
        date: timestamp,
        action: isDestroyed ? 'DESTROYED' : 'RETURN',
        details: `Returned ${item.name} (${item.barcode}) — Condition: ${conditionObj?.label} — ${isDestroyed ? 'Destroyed / removed from service' : `To ${targetStudioName} hamper`}`,
      };

      await update(ref(db), updates);
      setMessage({
        type: 'success',
        text: isDestroyed
          ? `${item.name} removed from service (${conditionObj?.label})`
          : `${item.name} returned to ${targetStudioName} hamper`,
      });
      setBarcode('');
      setCondition('');
      if (onRefresh) setTimeout(onRefresh, 500);
    } catch (error) {
      console.error('Return error:', error);
      setMessage({ type: 'error', text: 'Failed to return item. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="operation-content">
      <h3>Return Uniforms</h3>
      <p className="text-muted">Scan or enter barcode to return item</p>
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="form-group">
        <label>Return to Studio</label>
        <select value={targetStudioKey} onChange={e => setTargetStudioKey(e.target.value)} className="input-dark" disabled={loading}>
          {studioList.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
        <small className="text-muted">Item will be placed in this studio's hamper if condition allows</small>
      </div>

      <div className="form-group">
        <label>Barcode</label>
        <input
          type="text" value={barcode} onChange={e => setBarcode(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleReturn(); }}
          placeholder="Scan or enter barcode" className="input-dark" disabled={loading} autoFocus
        />
      </div>

      <div className="form-group">
        <label>Item Condition</label>
        <select value={condition} onChange={e => setCondition(e.target.value)} className="input-dark" disabled={loading}>
          <option value="">-- Select Condition --</option>
          <optgroup label="→ Enters Laundry">
            {RETURN_CONDITIONS.filter(c => c.action === 'laundry').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </optgroup>
          <optgroup label="→ Item Destroyed">
            {RETURN_CONDITIONS.filter(c => c.action === 'destroy').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </optgroup>
        </select>
        {conditionObj?.action === 'destroy' && (
          <small className="condition-warning">⚠ This will permanently remove the item from service</small>
        )}
        {conditionObj?.action === 'laundry' && (
          <small className="text-muted">✓ Item will enter the laundry system</small>
        )}
      </div>

      <button onClick={handleReturn} disabled={loading || !barcode.trim() || !condition} className="btn btn-gold">
        {loading ? 'Processing...' : 'Process Return'}
      </button>
    </div>
  );
}

// ─── ACTIVE LOANERS ────────────────────────────────────────────────────────

function ActiveLoaners({ cityKey, cityName, studioKey, studioName, inventory, studios = {}, onRefresh }: OperationComponentProps) {
  const [dateFilter, setDateFilter] = useState<7 | 30 | 90 | 365>(7);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const studioList = Object.entries(studios).map(([key, studio]) => ({ key, name: studio.name }));
  const cutoff = new Date(Date.now() - dateFilter * 24 * 60 * 60 * 1000).toISOString();

  const loaners = Object.entries(inventory).filter(([_, item]) => {
    if (item.status !== 'Loaner') return false;
    if (!item.issuedAt) return true;
    return item.issuedAt >= cutoff;
  });

  const handleReturn = async (itemKey: string) => {
    const item = inventory[itemKey];
    if (!item) return;
    setLoading(true);
    setMessage(null);
    try {
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      const returnStudioKey = item.issuedAtStudio || studioKey;
      const returnStudioName = studioList.find(s => s.key === returnStudioKey)?.name || studioName;

      updates[`inventory/${cityKey}/${itemKey}/status`] = 'In Hamper';
      updates[`inventory/${cityKey}/${itemKey}/returnedAt`] = timestamp;
      updates[`inventory/${cityKey}/${itemKey}/returnedAtStudio`] = returnStudioKey;
      updates[`inventory/${cityKey}/${itemKey}/returnedBy`] = CURRENT_USER;
      updates[`inventory/${cityKey}/${itemKey}/studioLocation`] = returnStudioName;

      if (studios[returnStudioKey]) {
        const currentCount = studios[returnStudioKey].currentHamperCount || 0;
        updates[`cities/${cityKey}/studios/${returnStudioKey}/currentHamperCount`] = currentCount + 1;
      }

      const assignmentsSnapshot = await get(ref(db, `assignments/${cityKey}`));
      const assignments = assignmentsSnapshot.val() || {};
      for (const [assignmentKey, assignment] of Object.entries(assignments) as [string, any][]) {
        if (assignment.itemBarcode === item.barcode && assignment.status === 'active') {
          updates[`assignments/${cityKey}/${assignmentKey}/returnedAt`] = timestamp;
          updates[`assignments/${cityKey}/${assignmentKey}/status`] = 'returned';
        }
      }

      const logKey = push(ref(db, `logs/${cityKey}/${returnStudioKey}`)).key;
      updates[`logs/${cityKey}/${returnStudioKey}/${logKey}`] = {
        date: timestamp, action: 'LOANER_RETURN',
        details: `Loaner returned: ${item.name} (${item.barcode}) → ${returnStudioName} hamper`,
      };

      await update(ref(db), updates);
      setMessage({ type: 'success', text: `${item.name} returned to hamper` });
      if (onRefresh) setTimeout(onRefresh, 500);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to return loaner.' });
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Item', 'Size', 'Barcode', 'Issued At', 'Issue Reason', 'Loaner Reason', 'Studio', 'Days Out'],
      ...loaners.map(([_, item]) => {
        const daysOut = item.issuedAt ? Math.floor((Date.now() - new Date(item.issuedAt).getTime()) / 86400000) : '';
        return [
          item.name, item.size, item.barcode,
          item.issuedAt ? new Date(item.issuedAt).toLocaleString() : '',
          ISSUE_REASONS.find(r => r.value === (item as any).issueReason)?.label || '',
          LOANER_REASONS.find(r => r.value === (item as any).loanerReason)?.label || '',
          item.studioLocation || '',
          daysOut,
        ];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `active-loaners-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="operation-content">
      <div className="loaners-header">
        <div>
          <h3>Active Loaners</h3>
          <p className="text-muted">{loaners.length} active loaner{loaners.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={exportCSV} className="btn btn-secondary" disabled={loaners.length === 0}>Export CSV</button>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="form-group">
        <label>Date Range</label>
        <div className="date-filter-buttons">
          {([7, 30, 90, 365] as const).map(d => (
            <button key={d} className={`btn btn-small ${dateFilter === d ? 'btn-gold' : 'btn-secondary'}`} onClick={() => setDateFilter(d)}>
              {d === 365 ? '1 Year' : `${d} Days`}
            </button>
          ))}
        </div>
      </div>

      {loaners.length === 0 ? (
        <p className="text-muted">No active loaners in the last {dateFilter === 365 ? '1 year' : `${dateFilter} days`}</p>
      ) : (
        <div className="loaners-list">
          {loaners.map(([key, item]) => {
            const issuedDate = item.issuedAt ? new Date(item.issuedAt) : null;
            const daysOut = issuedDate ? Math.floor((Date.now() - issuedDate.getTime()) / 86400000) : null;
            const loanerReasonLabel = LOANER_REASONS.find(r => r.value === (item as any).loanerReason)?.label;
            return (
              <div key={key} className={`loaner-card ${daysOut !== null && daysOut >= 7 ? 'loaner-overdue' : ''}`}>
                <div className="loaner-info">
                  <span className="loaner-item-name">{item.name} — {item.size}</span>
                  <span className="loaner-barcode">{item.barcode}</span>
                  {loanerReasonLabel && <span className="loaner-reason-badge">{loanerReasonLabel}</span>}
                  {daysOut !== null && (
                    <span className={`loaner-days ${daysOut >= 7 ? 'overdue' : ''}`}>
                      {daysOut === 0 ? 'Issued today' : `${daysOut} day${daysOut !== 1 ? 's' : ''} ago`}{daysOut >= 7 ? ' ⚠' : ''}
                    </span>
                  )}
                </div>
                <button onClick={() => handleReturn(key)} disabled={loading} className="btn btn-small btn-gold">Return</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── LAUNDRY ───────────────────────────────────────────────────────────────

function LaundryOperation({ cityKey, cityName, studioKey, studioName, inventory, onRefresh }: OperationComponentProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [operation, setOperation] = useState<'pickup' | 'receive'>('pickup');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const availableItems = Object.entries(inventory).filter(([_, item]) => {
    if (operation === 'pickup') return item.status === 'In Hamper' && item.studioLocation === studioName;
    return item.status === 'At Laundry';
  });

  const handleLaundryPickup = async () => {
    if (selectedItems.length === 0) { setMessage({ type: 'error', text: 'Please select items' }); return; }
    setLoading(true);
    setMessage(null);
    try {
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      const orderNumber = `LO-${Date.now()}`;
      const orderKey = push(ref(db, `laundry_orders/${cityKey}`)).key;
      updates[`laundry_orders/${cityKey}/${orderKey}`] = {
        orderNumber, items: selectedItems.map(k => inventory[k].barcode),
        createdAt: timestamp, pickedUpAt: timestamp, status: 'picked_up',
        city: cityName, studio: studioName, itemCount: selectedItems.length,
      };
      for (const itemKey of selectedItems) updates[`inventory/${cityKey}/${itemKey}/status`] = 'At Laundry';
      const hamperSnapshot = await get(ref(db, `cities/${cityKey}/studios/${studioKey}/currentHamperCount`));
      updates[`cities/${cityKey}/studios/${studioKey}/currentHamperCount`] = Math.max(0, (hamperSnapshot.val() || 0) - selectedItems.length);
      const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
      updates[`logs/${cityKey}/${studioKey}/${logKey}`] = { date: timestamp, action: 'LAUNDRY_PICKUP', details: `Laundry pickup ${orderNumber}: ${selectedItems.length} item(s) from ${studioName}` };
      await update(ref(db), updates);
      setMessage({ type: 'success', text: `Pickup ${orderNumber}: ${selectedItems.length} item(s) sent to laundry` });
      setSelectedItems([]);
      if (onRefresh) setTimeout(onRefresh, 500);
    } catch (err) { setMessage({ type: 'error', text: 'Failed to process pickup.' }); }
    finally { setLoading(false); }
  };

  const handleLaundryReceive = async () => {
    if (selectedItems.length === 0) { setMessage({ type: 'error', text: 'Please select items' }); return; }
    setLoading(true);
    setMessage(null);
    try {
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      for (const itemKey of selectedItems) {
        updates[`inventory/${cityKey}/${itemKey}/status`] = 'Available';
        updates[`inventory/${cityKey}/${itemKey}/studioLocation`] = studioName;
        Object.assign(updates, clearTrackingFields(`inventory/${cityKey}/${itemKey}`));
      }
      const ordersSnapshot = await get(ref(db, `laundry_orders/${cityKey}`));
      const orders = ordersSnapshot.val() || {};
      const selectedBarcodes = selectedItems.map(k => inventory[k].barcode);
      for (const [orderKey, order] of Object.entries(orders) as [string, any][]) {
        if (order.status === 'picked_up' && selectedBarcodes.some((bc: string) => (order.items || []).includes(bc))) {
          updates[`laundry_orders/${cityKey}/${orderKey}/returnedAt`] = timestamp;
          updates[`laundry_orders/${cityKey}/${orderKey}/status`] = 'returned';
        }
      }
      const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
      updates[`logs/${cityKey}/${studioKey}/${logKey}`] = { date: timestamp, action: 'LAUNDRY_RECEIVE', details: `Received ${selectedItems.length} item(s) from laundry at ${studioName}` };
      await update(ref(db), updates);
      setMessage({ type: 'success', text: `${selectedItems.length} item(s) received — now Available` });
      setSelectedItems([]);
      if (onRefresh) setTimeout(onRefresh, 500);
    } catch (err) { setMessage({ type: 'error', text: 'Failed to receive items.' }); }
    finally { setLoading(false); }
  };

  return (
    <div className="operation-content">
      <h3>Laundry Operations</h3>
      <p className="text-muted">Manage laundry pickup and return</p>
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
      <div className="form-group">
        <label>Operation</label>
        <select value={operation} onChange={e => { setOperation(e.target.value as 'pickup' | 'receive'); setSelectedItems([]); }} className="input-dark" disabled={loading}>
          <option value="pickup">Pickup from Hamper (In Hamper → At Laundry)</option>
          <option value="receive">Receive from Laundry (At Laundry → Available)</option>
        </select>
      </div>
      <div className="form-group">
        <label>{operation === 'pickup' ? `Items in Hamper at ${studioName}` : 'Items At Laundry'}</label>
        {availableItems.length === 0 ? (
          <p className="text-muted">{operation === 'pickup' ? 'No items in hamper' : 'No items at laundry'}</p>
        ) : (
          <div className="item-list">
            {availableItems.map(([key, item]) => (
              <label key={key} className="item-checkbox">
                <input type="checkbox" checked={selectedItems.includes(key)} onChange={e => setSelectedItems(e.target.checked ? [...selectedItems, key] : selectedItems.filter(k => k !== key))} disabled={loading} />
                <span>{item.name} - {item.size} ({item.barcode})</span>
              </label>
            ))}
          </div>
        )}
      </div>
      <button onClick={operation === 'pickup' ? handleLaundryPickup : handleLaundryReceive} disabled={loading || selectedItems.length === 0} className="btn btn-gold">
        {loading ? 'Processing...' : operation === 'pickup' ? `Send ${selectedItems.length} Item(s) to Laundry` : `Receive ${selectedItems.length} Item(s) from Laundry`}
      </button>
    </div>
  );
}

// ─── DAMAGE / LOST ─────────────────────────────────────────────────────────

function DamageOperation({ cityKey, cityName, studioKey, studioName, inventory, onRefresh }: OperationComponentProps) {
  const [barcode, setBarcode] = useState('');
  const [damageType, setDamageType] = useState<'damaged' | 'lost'>('damaged');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleMarkDamaged = async () => {
    if (!barcode.trim()) { setMessage({ type: 'error', text: 'Please enter a barcode' }); return; }
    setLoading(true);
    setMessage(null);
    try {
      const itemEntry = Object.entries(inventory).find(([_, item]) => item.barcode === barcode.trim());
      if (!itemEntry) { setMessage({ type: 'error', text: `Item with barcode ${barcode} not found` }); setLoading(false); return; }
      const [itemKey, item] = itemEntry;
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      const newStatus = damageType === 'damaged' ? 'Damaged' : 'Lost';
      updates[`inventory/${cityKey}/${itemKey}/status`] = newStatus;
      const damageKey = push(ref(db, `damages/${cityKey}`)).key;
      updates[`damages/${cityKey}/${damageKey}`] = { itemBarcode: item.barcode, itemName: item.name, damageType, reportedAt: timestamp, notes: notes.trim(), city: cityName, studio: studioName };
      const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
      updates[`logs/${cityKey}/${studioKey}/${logKey}`] = { date: timestamp, action: damageType.toUpperCase(), details: `Marked ${item.name} (${item.barcode}) as ${newStatus}${notes ? ': ' + notes : ''}` };
      await update(ref(db), updates);
      setMessage({ type: 'success', text: `${item.name} marked as ${newStatus}` });
      setBarcode('');
      setNotes('');
      if (onRefresh) setTimeout(onRefresh, 500);
    } catch (err) { setMessage({ type: 'error', text: 'Failed to mark item.' }); }
    finally { setLoading(false); }
  };

  return (
    <div className="operation-content">
      <h3>Mark Item as Damaged/Lost</h3>
      <p className="text-muted">Scan or enter barcode to mark item</p>
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}
      <div className="form-group">
        <label>Type</label>
        <select value={damageType} onChange={e => setDamageType(e.target.value as 'damaged' | 'lost')} className="input-dark" disabled={loading}>
          <option value="damaged">Damaged</option>
          <option value="lost">Lost</option>
        </select>
      </div>
      <div className="form-group">
        <label>Barcode</label>
        <input type="text" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Scan or enter barcode" className="input-dark" disabled={loading} />
      </div>
      <div className="form-group">
        <label>Notes (Optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional details" className="input-dark" rows={3} disabled={loading} />
      </div>
      <button onClick={handleMarkDamaged} disabled={loading || !barcode.trim()} className="btn btn-danger">
        {loading ? 'Processing...' : `Mark as ${damageType === 'damaged' ? 'Damaged' : 'Lost'}`}
      </button>
    </div>
  );
}

