import { useState, useRef, useEffect, useMemo } from 'react';
import { ref, update, push, get } from 'firebase/database';
import { db } from '../firebase';
import type { UniformItem, GamePresenter, Studio } from '../types';
import './Operations.css';

const CURRENT_USER = 'web-user';

const ISSUE_REASONS = [
  { value: 'loaner', label: 'Loaner', icon: '🔄' },
  { value: 'new_hire', label: 'New Hire', icon: '🆕' },
  { value: 'learned_new_game', label: 'Learned New Game', icon: '🎲' },
  { value: 'damaged_replacement', label: 'Damaged Replacement', icon: '🔧' },
  { value: 'size_swap', label: 'Size Swap', icon: '↕️' },
];

interface OperationsProps {
  cityKey: string;
  cityName: string;
  studioKey: string;
  studioName: string;
  inventory: Record<string, UniformItem>;
  gps: Record<string, GamePresenter>;
  assignments?: Record<string, any>;
  studios?: Record<string, Studio>;
  laundryEnabled?: boolean;
  onRefresh?: () => void;
}

export function Operations({
  cityKey, cityName, studioKey, studioName, inventory, gps,
  assignments = {}, studios = {}, laundryEnabled = true, onRefresh,
}: OperationsProps) {
  const [activeTab, setActiveTab] = useState<'issue' | 'return' | 'laundry' | 'damage'>('issue');

  const tabs: { id: 'issue' | 'return' | 'laundry' | 'damage'; label: string; icon: string }[] = [
    { id: 'issue',  label: 'Issue',        icon: '📤' },
    { id: 'return', label: 'Return',       icon: '📥' },
    ...(laundryEnabled ? [{ id: 'laundry' as const, label: 'Laundry', icon: '🧺' }] : []),
    { id: 'damage', label: 'Damage / Lost', icon: '⚠️' },
  ];

  return (
    <div className="operations-container card">
      <h2 className="text-accent">Operations</h2>

      <div className="ops-tabs tabs modern-tabs">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`ops-tab modern-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
              aria-pressed={isActive}
            >
              <span className="ops-tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="tab-content">
        {activeTab === 'issue' && (
          <IssueOperation cityKey={cityKey} cityName={cityName} studioKey={studioKey}
            studioName={studioName} inventory={inventory} gps={gps} studios={studios} onRefresh={onRefresh} />
        )}
        {activeTab === 'return' && (
          <ReturnOperation cityKey={cityKey} cityName={cityName} studioKey={studioKey}
            studioName={studioName} inventory={inventory} gps={gps} assignments={assignments} studios={studios}
            laundryEnabled={laundryEnabled} onRefresh={onRefresh} />
        )}
        {activeTab === 'laundry' && laundryEnabled && (
          <LaundryOperation cityKey={cityKey} cityName={cityName} studioKey={studioKey}
            studioName={studioName} inventory={inventory} studios={studios} onRefresh={onRefresh} />
        )}
        {activeTab === 'damage' && (
          <DamageOperation cityKey={cityKey} cityName={cityName} studioKey={studioKey}
            studioName={studioName} inventory={inventory} onRefresh={onRefresh} />
        )}
      </div>
    </div>
  );
}

// ─── STEP INDICATOR ──────────────────────────────────────────────────────────

function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="step-indicator">
      {steps.map((label, i) => (
        <div key={i} className={`step ${i < current ? 'done' : i === current ? 'active' : 'pending'}`}>
          <div className="step-circle">{i < current ? '✓' : i + 1}</div>
          <span className="step-label">{label}</span>
          {i < steps.length - 1 && <div className="step-line" />}
        </div>
      ))}
    </div>
  );
}

// ─── BARCODE INPUT ────────────────────────────────────────────────────────────

function BarcodeInput({
  label, placeholder, value, onChange, onSubmit, disabled, autoFocus, hint,
}: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; onSubmit: () => void;
  disabled?: boolean; autoFocus?: boolean; hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus && inputRef.current) inputRef.current.focus(); }, [autoFocus]);

  return (
    <div className="barcode-input-group">
      <label className="field-label">{label}</label>
      {hint && <p className="field-hint">{hint}</p>}
      <div className="barcode-row">
        <span className="barcode-icon">⬛</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
          placeholder={placeholder}
          className="input-dark barcode-field"
          disabled={disabled}
          autoFocus={autoFocus}
        />
        <button onClick={onSubmit} disabled={disabled || !value.trim()} className="btn btn-gold btn-scan">
          Confirm
        </button>
      </div>
    </div>
  );
}

// ─── SHARED INTERFACE ─────────────────────────────────────────────────────────

interface OperationComponentProps {
  cityKey: string; cityName: string; studioKey: string; studioName: string;
  inventory: Record<string, UniformItem>;
  gps?: Record<string, GamePresenter>;
  assignments?: Record<string, any>;
  studios?: Record<string, Studio>;
  laundryEnabled?: boolean;
  onRefresh?: () => void;
}

// ─── ISSUE OPERATION ──────────────────────────────────────────────────────────

type IssueStep = 'gp' | 'items' | 'reason' | 'loaner_reason' | 'confirm';

function IssueOperation({ cityKey, cityName, studioKey, studioName, inventory, gps, studios = {}, onRefresh }: OperationComponentProps) {
  const [step, setStep] = useState<IssueStep>('gp');
  const [gpSearch, setGpSearch] = useState('');
  const [selectedGP, setSelectedGP] = useState<{ name: string; barcode: string; key?: string } | null>(null);
  const [isNewGP, setIsNewGP] = useState(false);
  const [newGPName, setNewGPName] = useState('');
  const [newGPId, setNewGPId] = useState('');
  const [itemBarcode, setItemBarcode] = useState('');
  const [selectedItems, setSelectedItems] = useState<Array<{ key: string; item: UniformItem }>>([]);
  const [issueReason, setIssueReason] = useState('');
  const [loanerReason, setLoanerReason] = useState<'forgot' | 'pit_change' | ''>('');
  const [targetStudioKey, setTargetStudioKey] = useState(studioKey);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const studioList = useMemo(() =>
    Object.entries(studios)
      .filter(([, s]) => s && s.name)
      .map(([key, s]) => ({ key, name: s.name })),
  [studios]);

  // gps may be nested { cityKey: { gpId: {name,...} } } or flat { gpId: {name,...} }
  // Flatten to a consistent list regardless of DB structure
  const gpList = useMemo(() => {
    if (!gps) return [];
    const flat: Array<{ key: string; name: string; barcode: string }> = [];
    const seen = new Set<string>();
    const add = (key: string, gp: any) => {
      const gpName = gp?.name;
      if (gpName && typeof gpName === 'string' && !seen.has(key)) {
        seen.add(key);
        flat.push({ key, name: gpName, barcode: gp.barcode || '' });
      }
    };
    Object.entries(gps).forEach(([k, v]: [string, any]) => {
      if (v && typeof v === 'object') {
        if (typeof v.name === 'string') {
          add(k, v);               // flat: gpId → { name, barcode }
        } else {
          Object.entries(v).forEach(([subk, subv]) => add(subk, subv)); // nested: city → gp
        }
      }
    });
    return flat.sort((a, b) => a.name.localeCompare(b.name));
  }, [gps]);

  const filteredGPs = useMemo(() => {
    const q = gpSearch.trim().toLowerCase();
    if (!q) return gpList.slice(0, 8);
    return gpList.filter(gp =>
      gp.name.toLowerCase().includes(q) ||
      gp.barcode.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [gpList, gpSearch]);

  const handleGPLookup = () => {
    const q = gpSearch.trim().toLowerCase();
    const found = gpList.find(
      gp => gp.barcode === gpSearch.trim() || gp.name.toLowerCase() === q
    );
    if (found) {
      setSelectedGP({ name: found.name, barcode: found.barcode, key: found.key });
      setIsNewGP(false);
      setStep('items');
    } else if (gpSearch.trim()) {
      setIsNewGP(true);
    }
  };

  const handleAddNewGP = () => {
    if (!newGPName.trim() || !newGPId.trim()) {
      setMessage({ type: 'error', text: 'Name and ID card are required for a new GP' });
      return;
    }
    setSelectedGP({ name: newGPName.trim(), barcode: newGPId.trim() });
    setIsNewGP(false);
    setStep('items');
  };

  const handleAddItem = () => {
    if (!itemBarcode.trim()) return;
    const entry = Object.entries(inventory).find(([_, item]) => item.barcode === itemBarcode.trim());
    if (!entry) {
      setMessage({ type: 'error', text: `Barcode "${itemBarcode}" not found in inventory` });
      return;
    }
    const [key, item] = entry;
    if (item.status !== 'Available' && item.status !== 'In Stock') {
      setMessage({ type: 'error', text: `Item "${item.name}" is not available (status: ${item.status})` });
      return;
    }
    if (selectedItems.find(s => s.key === key)) {
      setMessage({ type: 'error', text: 'Item already added to this issue batch' });
      return;
    }
    setSelectedItems([...selectedItems, { key, item }]);
    setItemBarcode('');
    setMessage(null);
  };

  const handleIssue = async () => {
    if (!selectedGP || selectedItems.length === 0 || !issueReason) return;
    setLoading(true);
    setMessage(null);
    try {
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      const targetStudioName = studioList.find(s => s.key === targetStudioKey)?.name || studioName;

      for (const { key: itemKey, item } of selectedItems) {
        updates[`inventory/${cityKey}/${itemKey}/status`] = 'Issued';
        updates[`inventory/${cityKey}/${itemKey}/issuedAt`] = timestamp;
        updates[`inventory/${cityKey}/${itemKey}/issuedAtStudio`] = targetStudioKey;
        updates[`inventory/${cityKey}/${itemKey}/issuedAtCity`] = cityKey;
        updates[`inventory/${cityKey}/${itemKey}/issuedBy`] = CURRENT_USER;
        updates[`inventory/${cityKey}/${itemKey}/issueReason`] = issueReason;

        const assignmentKey = push(ref(db, `assignments/${cityKey}`)).key;
        updates[`assignments/${cityKey}/${assignmentKey}`] = {
          itemBarcode: item.barcode, itemName: item.name, itemSize: item.size,
          gpName: selectedGP.name, gpBarcode: selectedGP.barcode,
          issuedAt: timestamp, issuedAtStudio: targetStudioKey, issuedAtCity: cityKey,
          issuedBy: CURRENT_USER, issueReason, status: 'active',
          city: cityName, studio: targetStudioName,
          ...(issueReason === 'loaner' && loanerReason ? { loanerReason } : {}),
        };
      }

      if (!selectedGP.key) {
        const gpKey = push(ref(db, `gamePresenters/${cityKey}`)).key;
        updates[`gamePresenters/${cityKey}/${gpKey}`] = {
          name: selectedGP.name, barcode: selectedGP.barcode,
          city: cityName, studio: targetStudioName,
        };
      }

      const logKey = push(ref(db, `logs/${cityKey}/${targetStudioKey}`)).key;
      const reasonLabel = ISSUE_REASONS.find(r => r.value === issueReason)?.label || issueReason;
      const loanerLabel = issueReason === 'loaner' && loanerReason
        ? ` (${loanerReason === 'forgot' ? 'Forgot uniform' : 'Pit was changed'})`
        : '';
      updates[`logs/${cityKey}/${targetStudioKey}/${logKey}`] = {
        date: timestamp, action: 'ISSUE',
        details: `Issued ${selectedItems.length} item(s) to ${selectedGP.name} — Reason: ${reasonLabel}${loanerLabel} — Items: ${selectedItems.map(s => s.item.name).join(', ')}`,
      };

      await update(ref(db), updates);
      setMessage({ type: 'success', text: `✓ Issued ${selectedItems.length} item(s) to ${selectedGP.name}` });

      setTimeout(() => {
        setStep('gp'); setGpSearch(''); setSelectedGP(null);
        setSelectedItems([]); setIssueReason(''); setLoanerReason(''); setItemBarcode(''); setMessage(null);
        if (onRefresh) onRefresh();
      }, 2000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to issue items. Please try again.' });
    } finally { setLoading(false); }
  };

  const stepIndex = ['gp', 'items', 'reason', 'loaner_reason', 'confirm'].indexOf(step) === 3
    ? 2 // loaner_reason shows as step 3 (Reason)
    : ['gp', 'items', 'reason', 'confirm'].indexOf(step === 'loaner_reason' ? 'reason' : step);

  return (
    <div className="operation-content">
      <StepIndicator steps={['Identify GP', 'Scan Items', 'Reason', 'Confirm']} current={stepIndex} />
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {/* STEP 1: GP */}
      {step === 'gp' && (
        <div className="step-panel">
          <h3 className="step-title">Step 1 — Identify Game Presenter</h3>
          <p className="text-muted">Scan GP ID card with USB scanner or type their name/ID</p>

          <BarcodeInput
            label="GP ID Card or Name"
            placeholder="Scan or type GP ID / name..."
            value={gpSearch}
            onChange={setGpSearch}
            onSubmit={handleGPLookup}
            autoFocus
            hint="USB barcode scanner will auto-submit"
          />

          {gpSearch && !isNewGP && filteredGPs.length > 0 && (
            <div className="gp-suggestions">
              {filteredGPs.slice(0, 6).map(gp => (
                <button key={gp.key} className="gp-suggestion-item" onClick={() => {
                  setSelectedGP({ name: gp.name, barcode: gp.barcode || '', key: gp.key });
                  setStep('items');
                }}>
                  <span className="gp-name">{gp.name}</span>
                  <span className="gp-id">{gp.barcode}</span>
                </button>
              ))}
            </div>
          )}

          {/* Manual add button — always visible if search has text and no exact match */}
          {gpSearch && !isNewGP && (
            <button
              className="btn btn-dark"
              style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}
              onClick={() => { setIsNewGP(true); setNewGPName(gpSearch); setNewGPId(''); }}
            >
              + Add "{gpSearch}" as New GP
            </button>
          )}

          {isNewGP && (
            <div className="new-gp-panel">
              <div className="new-gp-header">
                <span className="new-gp-badge">New GP</span>
                <span className="text-muted">"{gpSearch}" not found — add them?</span>
              </div>
              <div className="form-group">
                <label className="field-label">Full Name</label>
                <input type="text" value={newGPName} onChange={e => setNewGPName(e.target.value)}
                  placeholder="Game Presenter full name" className="input-dark" autoFocus />
              </div>
              <div className="form-group">
                <label className="field-label">ID Card Number</label>
                <input type="text" value={newGPId} onChange={e => setNewGPId(e.target.value)}
                  placeholder="ID card / barcode" className="input-dark"
                  onKeyDown={e => e.key === 'Enter' && handleAddNewGP()} />
              </div>
              <div className="button-row">
                <button onClick={handleAddNewGP} className="btn btn-gold">Add & Continue</button>
                <button onClick={() => { setIsNewGP(false); setGpSearch(''); }} className="btn btn-dark">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: ITEMS */}
      {step === 'items' && selectedGP && (
        <div className="step-panel">
          <div className="gp-confirmed-banner">
            <span className="gp-confirmed-label">GP</span>
            <strong>{selectedGP.name}</strong>
            <span className="gp-confirmed-id">{selectedGP.barcode}</span>
            <button className="btn-link" onClick={() => { setStep('gp'); setSelectedGP(null); setSelectedItems([]); }}>Change</button>
          </div>

          <h3 className="step-title">Step 2 — Scan Uniform Items</h3>
          <p className="text-muted">Scan each item's barcode. Press Enter or use scanner.</p>

          <div className="form-group">
            <label className="field-label">Issue from Studio</label>
            <select value={targetStudioKey} onChange={e => { setTargetStudioKey(e.target.value); setSelectedItems([]); }} className="input-dark">
              {studioList.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </div>

          <BarcodeInput
            label="Item Barcode"
            placeholder="Scan or enter item barcode..."
            value={itemBarcode}
            onChange={setItemBarcode}
            onSubmit={handleAddItem}
            autoFocus
          />

          {selectedItems.length > 0 && (
            <div className="scanned-items-list">
              <div className="scanned-items-header">
                <span>Scanned Items ({selectedItems.length})</span>
              </div>
              {selectedItems.map(({ key, item }) => (
                <div key={key} className="scanned-item">
                  <span className="scanned-item-name">{item.name}</span>
                  <span className="scanned-item-size">{item.size}</span>
                  <code className="barcode">{item.barcode}</code>
                  <button className="btn-remove" onClick={() => setSelectedItems(selectedItems.filter(s => s.key !== key))}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="button-row">
            <button onClick={() => setStep('reason')} disabled={selectedItems.length === 0} className="btn btn-gold">
              Next — Choose Reason →
            </button>
            <button onClick={() => setStep('gp')} className="btn btn-dark">← Back</button>
          </div>
        </div>
      )}

      {/* STEP 3: REASON */}
      {step === 'reason' && (
        <div className="step-panel">
          <h3 className="step-title">Step 3 — Reason for Issue</h3>
          <p className="text-muted">Select the reason these items are being issued</p>

          <div className="reason-grid">
            {ISSUE_REASONS.map(r => (
              <button
                key={r.value}
                className={`reason-card ${issueReason === r.value ? 'selected' : ''}`}
                onClick={() => setIssueReason(r.value)}
              >
                <span className="reason-icon">{r.icon}</span>
                <span className="reason-label">{r.label}</span>
              </button>
            ))}
          </div>

          <div className="button-row">
            <button
              onClick={() => setStep(issueReason === 'loaner' ? 'loaner_reason' : 'confirm')}
              disabled={!issueReason}
              className="btn btn-gold"
            >
              Next — Review →
            </button>
            <button onClick={() => setStep('items')} className="btn btn-dark">← Back</button>
          </div>
        </div>
      )}

      {/* STEP 3b: LOANER REASON */}
      {step === 'loaner_reason' && (
        <div className="step-panel">
          <h3 className="step-title">Loaner — Why?</h3>
          <p className="text-muted">Select the reason for this loaner issue</p>

          <div className="loaner-reason-grid">
            <button
              className={`loaner-reason-card ${loanerReason === 'forgot' ? 'selected' : ''}`}
              onClick={() => setLoanerReason('forgot')}
            >
              <span className="loaner-reason-icon">😅</span>
              <span className="loaner-reason-label">Forgot Uniform</span>
              <span className="loaner-reason-sub">GP left their uniform at home</span>
            </button>
            <button
              className={`loaner-reason-card ${loanerReason === 'pit_change' ? 'selected' : ''}`}
              onClick={() => setLoanerReason('pit_change')}
            >
              <span className="loaner-reason-icon">🔁</span>
              <span className="loaner-reason-label">Pit Was Changed</span>
              <span className="loaner-reason-sub">GP moved to a different game</span>
            </button>
          </div>

          <div className="button-row" style={{ marginTop: '1.5rem' }}>
            <button
              onClick={() => setStep('confirm')}
              disabled={!loanerReason}
              className="btn btn-gold"
            >
              Next — Review →
            </button>
            <button onClick={() => setStep('reason')} className="btn btn-dark">← Back</button>
          </div>
        </div>
      )}

      {/* STEP 4: CONFIRM */}
      {step === 'confirm' && selectedGP && (
        <div className="step-panel">
          <h3 className="step-title">Step 4 — Confirm Issue</h3>

          <div className="confirm-summary">
            <div className="confirm-row">
              <span className="confirm-label">Game Presenter</span>
              <span className="confirm-value">{selectedGP.name} <code className="barcode">{selectedGP.barcode}</code></span>
            </div>
            <div className="confirm-row">
              <span className="confirm-label">Studio</span>
              <span className="confirm-value">{studioList.find(s => s.key === targetStudioKey)?.name || studioName}</span>
            </div>
            <div className="confirm-row">
              <span className="confirm-label">Reason</span>
              <span className="confirm-value">
                {ISSUE_REASONS.find(r => r.value === issueReason)?.label}
                {issueReason === 'loaner' && loanerReason && (
                  <span className="confirm-subreason">
                    — {loanerReason === 'forgot' ? '😅 Forgot Uniform' : '🔁 Pit Was Changed'}
                  </span>
                )}
              </span>
            </div>
            <div className="confirm-row">
              <span className="confirm-label">Items ({selectedItems.length})</span>
              <div className="confirm-items">
                {selectedItems.map(({ key, item }) => (
                  <div key={key} className="confirm-item">
                    <span>{item.name} — {item.size}</span>
                    <code className="barcode">{item.barcode}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="button-row">
            <button onClick={handleIssue} disabled={loading} className="btn btn-gold btn-lg">
              {loading ? 'Issuing...' : `✓ Confirm Issue (${selectedItems.length} items)`}
            </button>
            <button onClick={() => setStep('reason')} disabled={loading} className="btn btn-dark">← Back</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RETURN OPERATION ─────────────────────────────────────────────────────────

// ─── RETURN OPERATION ─────────────────────────────────────────────────────────

type ReturnStep = 'gp' | 'items' | 'status';

function ReturnOperation({ cityKey, cityName, studioKey, studioName, inventory, gps, assignments = {}, studios = {}, laundryEnabled = true, onRefresh }: OperationComponentProps) {
  const [step, setStep] = useState<ReturnStep>('gp');
  const [gpSearch, setGpSearch] = useState('');
  const [resolvedGP, setResolvedGP] = useState<{ name: string; barcode: string } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [itemBarcode, setItemBarcode] = useState('');
  const [returnItems, setReturnItems] = useState<Array<{ key: string; item: UniformItem; disposition: 'cleaner' | 'unwearable' | null }>>([]);
  const [targetStudioKey, setTargetStudioKey] = useState(studioKey);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const studioList = useMemo(() =>
    Object.entries(studios).filter(([, s]) => s && s.name).map(([key, s]) => ({ key, name: s.name })),
  [studios]);

  // Flatten gps same as IssueOperation
  const gpList = useMemo(() => {
    if (!gps) return [];
    const flat: Array<{ key: string; name: string; barcode: string }> = [];
    const seen = new Set<string>();
    const add = (key: string, gp: any) => {
      const gpName = gp?.name;
      if (gpName && typeof gpName === 'string' && !seen.has(key)) {
        seen.add(key);
        flat.push({ key, name: gpName, barcode: gp.barcode || '' });
      }
    };
    Object.entries(gps).forEach(([k, v]: [string, any]) => {
      if (v && typeof v === 'object') {
        if (typeof v.name === 'string') { add(k, v); }
        else { Object.entries(v).forEach(([subk, subv]) => add(subk, subv)); }
      }
    });
    return flat.sort((a, b) => a.name.localeCompare(b.name));
  }, [gps]);

  const filteredReturnGPs = useMemo(() => {
    const q = gpSearch.trim().toLowerCase();
    if (!q) return gpList.slice(0, 8);
    return gpList.filter(gp =>
      gp.name.toLowerCase().includes(q) || gp.barcode.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [gpList, gpSearch]);

  // All items currently assigned (active) to the selected GP
  const gpActiveItems = useMemo(() => {
    if (!resolvedGP) return [];
    const results: Array<{ key: string; item: UniformItem }> = [];
    Object.entries(assignments).forEach(([, a]: [string, any]) => {
      if (a.status !== 'active') return;
      const nameMatch = resolvedGP.name && a.gpName?.toLowerCase() === resolvedGP.name.toLowerCase();
      const barcodeMatch = resolvedGP.barcode && a.gpBarcode === resolvedGP.barcode;
      if (!nameMatch && !barcodeMatch) return;
      // Find the inventory item by barcode
      const invEntry = Object.entries(inventory).find(([, item]) => item.barcode === a.itemBarcode);
      if (invEntry) {
        const [invKey, invItem] = invEntry;
        if (invItem.status === 'Issued' && !results.find(r => r.key === invKey)) {
          results.push({ key: invKey, item: invItem });
        }
      }
    });
    return results;
  }, [resolvedGP, assignments, inventory]);

  const selectGP = (gp: { name: string; barcode: string }) => {
    setResolvedGP(gp);
    setGpSearch(gp.name);
    setShowSuggestions(false);
    setStep('items');
  };

  const handleGPLookup = () => {
    if (!gpSearch.trim()) return;
    const q = gpSearch.trim().toLowerCase();
    const found = gpList.find(gp => gp.barcode === gpSearch.trim() || gp.name.toLowerCase() === q);
    if (found) {
      selectGP({ name: found.name, barcode: found.barcode });
    } else {
      setResolvedGP({ name: gpSearch.trim(), barcode: gpSearch.trim() });
      setShowSuggestions(false);
      setStep('items');
    }
  };

  const handleAddReturnItem = () => {
    if (!itemBarcode.trim()) return;
    const entry = Object.entries(inventory).find(([, item]) => item.barcode === itemBarcode.trim());
    if (!entry) { setMessage({ type: 'error', text: `Barcode "${itemBarcode}" not found` }); return; }
    const [key, item] = entry;
    if (item.status !== 'Issued') {
      setMessage({ type: 'error', text: `"${item.name}" is not currently Issued (status: ${item.status})` }); return;
    }
    if (returnItems.find(r => r.key === key)) {
      setMessage({ type: 'error', text: 'Item already in return list' }); return;
    }
    setReturnItems(prev => [...prev, { key, item, disposition: null }]);
    setItemBarcode('');
    setMessage(null);
  };

  const addItemFromList = (key: string, item: UniformItem) => {
    if (returnItems.find(r => r.key === key)) {
      setMessage({ type: 'warning', text: 'Already added' }); return;
    }
    setReturnItems(prev => [...prev, { key, item, disposition: null }]);
    setMessage(null);
  };

  const setDisposition = (key: string, disposition: 'cleaner' | 'unwearable') => {
    setReturnItems(returnItems.map(r => r.key === key ? { ...r, disposition } : r));
  };

  const allDispositioned = returnItems.length > 0 && returnItems.every(r => r.disposition !== null);

  const handleReturn = async () => {
    if (!allDispositioned) return;
    setLoading(true); setMessage(null);
    try {
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      const targetStudioName = studioList.find(s => s.key === targetStudioKey)?.name || studioName;
      let hamperIncrement = 0;

      for (const { key: itemKey, item, disposition } of returnItems) {
        if (disposition === 'cleaner') {
          const newStatus = laundryEnabled ? 'In Hamper' : 'Available';
          updates[`inventory/${cityKey}/${itemKey}/status`] = newStatus;
          updates[`inventory/${cityKey}/${itemKey}/returnedAt`] = timestamp;
          updates[`inventory/${cityKey}/${itemKey}/returnedAtStudio`] = targetStudioKey;
          updates[`inventory/${cityKey}/${itemKey}/returnedBy`] = resolvedGP?.barcode || CURRENT_USER;
          updates[`inventory/${cityKey}/${itemKey}/studioLocation`] = targetStudioName;
          if (laundryEnabled) {
            hamperIncrement++;
          } else {
            updates[`inventory/${cityKey}/${itemKey}/issuedAt`] = null;
            updates[`inventory/${cityKey}/${itemKey}/issuedAtStudio`] = null;
            updates[`inventory/${cityKey}/${itemKey}/issuedBy`] = null;
          }
        } else {
          updates[`inventory/${cityKey}/${itemKey}/status`] = 'Damaged';
          const damageKey = push(ref(db, `damages/${cityKey}`)).key;
          updates[`damages/${cityKey}/${damageKey}`] = {
            itemBarcode: item.barcode, itemName: item.name, damageType: 'damaged',
            reportedAt: timestamp, notes: 'Returned as unwearable',
            city: cityName, studio: targetStudioName, returnedBy: resolvedGP?.barcode || CURRENT_USER,
          };
        }

        // Close active assignment
        const assignmentsSnapshot = await get(ref(db, `assignments/${cityKey}`));
        const cityAssignments = assignmentsSnapshot.val() || {};
        for (const [aKey, a] of Object.entries(cityAssignments) as [string, any][]) {
          if (a.itemBarcode === item.barcode && a.status === 'active') {
            updates[`assignments/${cityKey}/${aKey}/returnedAt`] = timestamp;
            updates[`assignments/${cityKey}/${aKey}/returnedAtStudio`] = targetStudioKey;
            updates[`assignments/${cityKey}/${aKey}/returnedBy`] = resolvedGP?.barcode || CURRENT_USER;
            updates[`assignments/${cityKey}/${aKey}/status`] = 'returned';
          }
        }
      }

      if (hamperIncrement > 0 && studios[targetStudioKey]) {
        const currentCount = studios[targetStudioKey].currentHamperCount || 0;
        updates[`cities/${cityKey}/studios/${targetStudioKey}/currentHamperCount`] = currentCount + hamperIncrement;
      }

      const logKey = push(ref(db, `logs/${cityKey}/${targetStudioKey}`)).key;
      const cleanerItems = returnItems.filter(r => r.disposition === 'cleaner').map(r => r.item.barcode).join(', ');
      const damagedItems = returnItems.filter(r => r.disposition === 'unwearable').map(r => r.item.barcode).join(', ');
      updates[`logs/${cityKey}/${targetStudioKey}/${logKey}`] = {
        date: timestamp, action: 'RETURN',
        details: `Return by ${resolvedGP?.name || resolvedGP?.barcode || 'staff'} at ${targetStudioName}${cleanerItems ? ' | To cleaner: ' + cleanerItems : ''}${damagedItems ? ' | Damaged out: ' + damagedItems : ''}`,
      };

      await update(ref(db), updates);
      setMessage({ type: 'success', text: `✓ ${returnItems.length} item(s) returned` });

      setTimeout(() => {
        setStep('gp'); setGpSearch(''); setResolvedGP(null);
        setReturnItems([]); setItemBarcode(''); setMessage(null);
        if (onRefresh) onRefresh();
      }, 2000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Return failed. Please try again.' });
    } finally { setLoading(false); }
  };

  const stepIndex = ['gp', 'items', 'status'].indexOf(step);

  return (
    <div className="operation-content">
      <StepIndicator steps={['Identify GP', 'Select Items', 'Item Status']} current={stepIndex} />
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {/* STEP 1: IDENTIFY GP */}
      {step === 'gp' && (
        <div className="step-panel">
          <h3 className="step-title">Step 1 — Identify Returning GP</h3>
          <p className="text-muted">Scan GP ID card or type their name</p>

          <BarcodeInput
            label="GP ID Card or Name"
            placeholder="Scan or type GP ID / name..."
            value={gpSearch}
            onChange={v => { setGpSearch(v); setShowSuggestions(true); }}
            onSubmit={handleGPLookup}
            autoFocus
            hint="USB barcode scanner will auto-submit"
          />

          {showSuggestions && gpSearch && filteredReturnGPs.length > 0 && (
            <div className="gp-suggestions">
              {filteredReturnGPs.map(gp => (
                <button key={gp.key} className="gp-suggestion-item" onClick={() => selectGP(gp)}>
                  <span className="gp-name">{gp.name}</span>
                  <span className="gp-id">{gp.barcode}</span>
                </button>
              ))}
            </div>
          )}

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="field-label">Return to Studio</label>
            <select value={targetStudioKey} onChange={e => setTargetStudioKey(e.target.value)} className="input-dark">
              {studioList.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </div>

          <button onClick={handleGPLookup} disabled={!gpSearch.trim()} className="btn btn-gold" style={{ marginTop: '0.5rem' }}>
            Continue →
          </button>
        </div>
      )}

      {/* STEP 2: SELECT ITEMS */}
      {step === 'items' && (
        <div className="step-panel">
          <div className="gp-confirmed-banner">
            <span className="gp-confirmed-label">Returning</span>
            <strong>{resolvedGP?.name}</strong>
            {resolvedGP?.barcode && resolvedGP.barcode !== resolvedGP.name && (
              <span className="gp-confirmed-id">{resolvedGP.barcode}</span>
            )}
            <button className="btn-link" onClick={() => { setStep('gp'); setResolvedGP(null); setGpSearch(''); setReturnItems([]); }}>Change</button>
          </div>

          <h3 className="step-title">Step 2 — Select Items Being Returned</h3>

          {/* Active items assigned to this GP */}
          {gpActiveItems.length > 0 && (
            <div className="gp-active-items">
              <div className="gp-active-items-header">
                <span>📋 Items currently issued to {resolvedGP?.name}</span>
                <button className="btn-link" onClick={() => {
                  gpActiveItems.forEach(({ key, item }) => {
                    if (!returnItems.find(r => r.key === key)) {
                      setReturnItems(prev => [...prev, { key, item, disposition: null }]);
                    }
                  });
                }}>Add all</button>
              </div>
              {gpActiveItems.map(({ key, item }) => {
                const alreadyAdded = !!returnItems.find(r => r.key === key);
                return (
                  <div key={key} className={`gp-active-item ${alreadyAdded ? 'added' : ''}`}>
                    <span className="scanned-item-name">{item.name}</span>
                    <span className="scanned-item-size">{item.size}</span>
                    <code className="barcode small">{item.barcode}</code>
                    <button
                      className="btn btn-dark btn-sm"
                      onClick={() => addItemFromList(key, item)}
                      disabled={alreadyAdded}
                    >
                      {alreadyAdded ? '✓ Added' : '+ Return'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Manual barcode scan */}
          <div style={{ marginTop: gpActiveItems.length > 0 ? '1rem' : '0' }}>
            <BarcodeInput
              label={gpActiveItems.length > 0 ? 'Or scan a barcode manually' : 'Item Barcode'}
              placeholder="Scan or enter item barcode..."
              value={itemBarcode}
              onChange={setItemBarcode}
              onSubmit={handleAddReturnItem}
              autoFocus={gpActiveItems.length === 0}
            />
          </div>

          {returnItems.length > 0 && (
            <div className="scanned-items-list">
              <div className="scanned-items-header">Return list ({returnItems.length})</div>
              {returnItems.map(({ key, item }) => (
                <div key={key} className="scanned-item">
                  <span className="scanned-item-name">{item.name}</span>
                  <span className="scanned-item-size">{item.size}</span>
                  <code className="barcode">{item.barcode}</code>
                  <button className="btn-remove" onClick={() => setReturnItems(returnItems.filter(r => r.key !== key))}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="button-row">
            <button onClick={() => setStep('status')} disabled={returnItems.length === 0} className="btn btn-gold">
              Next — Set Item Condition →
            </button>
            <button onClick={() => setStep('gp')} className="btn btn-dark">← Back</button>
          </div>
        </div>
      )}

      {/* STEP 3: ITEM STATUS */}
      {step === 'status' && (
        <div className="step-panel">
          <h3 className="step-title">Step 3 — Item Condition</h3>
          <p className="text-muted">For each item, choose what happens to it</p>
          <div className="disposition-list">
            {returnItems.map(({ key, item, disposition }) => (
              <div key={key} className="disposition-item">
                <div className="disposition-item-info">
                  <span className="scanned-item-name">{item.name} — {item.size}</span>
                  <code className="barcode">{item.barcode}</code>
                </div>
                <div className="disposition-buttons">
                  <button
                    className={`disposition-btn ${disposition === 'cleaner' ? 'selected-cleaner' : ''}`}
                    onClick={() => setDisposition(key, 'cleaner')}
                  >
                    {laundryEnabled ? '🧺 Send to Cleaner' : '✅ Return to Available'}
                  </button>
                  <button
                    className={`disposition-btn ${disposition === 'unwearable' ? 'selected-damage' : ''}`}
                    onClick={() => setDisposition(key, 'unwearable')}
                  >
                    ⚠️ Unwearable
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="button-row">
            <button onClick={handleReturn} disabled={loading || !allDispositioned} className="btn btn-gold btn-lg">
              {loading ? 'Processing...' : `✓ Confirm Return (${returnItems.length} items)`}
            </button>
            <button onClick={() => setStep('items')} disabled={loading} className="btn btn-dark">← Back</button>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── LAUNDRY OPERATION ───────────────────────────────────────────────────────

function LaundryOperation({ cityKey, cityName, studioKey, studioName, inventory, studios = {}, onRefresh }: OperationComponentProps) {
  const [operation, setOperation] = useState<'pickup' | 'receive'>('pickup');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Find the home studio for this city (marked with homeStudio: true in admin)
  const homeStudioEntry = useMemo(() =>
    Object.entries(studios).find(([, s]) => (s as any).homeStudio),
  [studios]);
  const homeStudioKey  = homeStudioEntry?.[0] ?? studioKey;
  const homeStudioName = (homeStudioEntry?.[1] as any)?.name ?? studioName;
  const hasHomeStudio  = !!homeStudioEntry;

  const availableItems = Object.entries(inventory).filter(([, item]) => {
    if (operation === 'pickup') {
      return item.status === 'In Hamper' && (
        item.studioLocation?.trim().toLowerCase() === studioName?.trim().toLowerCase() ||
        item.studioLocation?.trim().toLowerCase() === studioKey?.trim().toLowerCase()
      );
    }
    return item.status === 'At Laundry';
  });

  const toggleItem = (key: string) =>
    setSelectedItems(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const selectAll = () => setSelectedItems(availableItems.map(([k]) => k));
  const clearAll  = () => setSelectedItems([]);

  const handleSubmit = async () => {
    if (selectedItems.length === 0) return;
    setLoading(true); setMessage(null);
    try {
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();

      if (operation === 'pickup') {
        const orderNumber = `LO-${Date.now()}`;
        const orderKey = push(ref(db, `laundry_orders/${cityKey}`)).key;
        updates[`laundry_orders/${cityKey}/${orderKey}`] = {
          orderNumber, items: selectedItems.map(k => inventory[k].barcode),
          createdAt: timestamp, pickedUpAt: timestamp,
          status: 'picked_up', city: cityName, studio: studioName,
          itemCount: selectedItems.length,
        };
        for (const k of selectedItems) {
          updates[`inventory/${cityKey}/${k}/status`] = 'At Laundry';
        }
        const snap = await get(ref(db, `cities/${cityKey}/studios/${studioKey}/currentHamperCount`));
        const cnt = snap.val() || 0;
        updates[`cities/${cityKey}/studios/${studioKey}/currentHamperCount`] = Math.max(0, cnt - selectedItems.length);
        const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
        updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
          date: timestamp, action: 'LAUNDRY_PICKUP',
          details: `Pickup ${orderNumber}: ${selectedItems.length} item(s) from ${studioName}`,
        };
      } else {
        // Return all items to home studio (or current studio if no home set)
        for (const k of selectedItems) {
          updates[`inventory/${cityKey}/${k}/status`] = 'Available';
          updates[`inventory/${cityKey}/${k}/studioLocation`] = homeStudioName;
          updates[`inventory/${cityKey}/${k}/issuedAt`] = null;
          updates[`inventory/${cityKey}/${k}/issuedAtStudio`] = null;
          updates[`inventory/${cityKey}/${k}/issuedBy`] = null;
          updates[`inventory/${cityKey}/${k}/returnedAt`] = null;
          updates[`inventory/${cityKey}/${k}/returnedAtStudio`] = null;
        }
        const logKey = push(ref(db, `logs/${cityKey}/${homeStudioKey}`)).key;
        updates[`logs/${cityKey}/${homeStudioKey}/${logKey}`] = {
          date: timestamp, action: 'LAUNDRY_RECEIVE',
          details: `Received ${selectedItems.length} item(s) from laundry → Available at ${homeStudioName}${hasHomeStudio && homeStudioKey !== studioKey ? ' (home studio)' : ''}`,
        };
      }

      await update(ref(db), updates);
      const dest = operation === 'pickup' ? 'sent to laundry' : `received — now Available at ${homeStudioName}`;
      setMessage({ type: 'success', text: `✓ ${selectedItems.length} item(s) ${dest}` });
      setSelectedItems([]);
      if (onRefresh) setTimeout(onRefresh, 500);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to process. Please try again.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="operation-content">
      <h3 className="step-title">Laundry Operations</h3>
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {operation === 'receive' && (
        <div className="home-studio-notice">
          {hasHomeStudio
            ? `🏠 Items will return to home studio: ${homeStudioName}`
            : `⚠️ No home studio set — items will return to ${studioName}. Set a home studio in Admin → Cities & Studios.`}
        </div>
      )}

      <div className="laundry-toggle-row">
        <button
          className={`laundry-toggle-btn ${operation === 'pickup' ? 'active' : ''}`}
          onClick={() => { setOperation('pickup'); setSelectedItems([]); }}
        >
          <span>🧺</span> Hamper → At Laundry
        </button>
        <button
          className={`laundry-toggle-btn ${operation === 'receive' ? 'active' : ''}`}
          onClick={() => { setOperation('receive'); setSelectedItems([]); }}
        >
          <span>✅</span> At Laundry → Available
        </button>
      </div>

      <div className="item-select-header">
        <span className="text-muted">
          {operation === 'pickup' ? `Items in hamper at ${studioName}` : 'Items currently at laundry'}
          {' '}({availableItems.length})
        </span>
        <div className="select-actions">
          <button className="btn-link" onClick={selectAll}>All</button>
          <button className="btn-link" onClick={clearAll}>None</button>
        </div>
      </div>

      {availableItems.length === 0 ? (
        <p className="empty-state-inline text-muted">
          {operation === 'pickup' ? 'No items in hamper at this studio' : 'No items at laundry'}
        </p>
      ) : (
        <div className="item-list">
          {availableItems.map(([key, item]) => (
            <label key={key} className="item-checkbox">
              <input type="checkbox" checked={selectedItems.includes(key)} onChange={() => toggleItem(key)} />
              <span>{item.name} — {item.size} <code className="barcode small">{item.barcode}</code>
                {operation === 'receive' && (
                  <span className="item-return-dest"> → {homeStudioName}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}

      <button onClick={handleSubmit} disabled={loading || selectedItems.length === 0} className="btn btn-gold">
        {loading ? 'Processing...' : operation === 'pickup'
          ? `Send ${selectedItems.length} to Laundry`
          : `Return ${selectedItems.length} to ${homeStudioName}`}
      </button>
    </div>
  );
}


// ─── DAMAGE OPERATION ─────────────────────────────────────────────────────────

function DamageOperation({ cityKey, cityName, studioKey, studioName, inventory, onRefresh }: OperationComponentProps) {
  const [barcode, setBarcode] = useState('');
  const [damageType, setDamageType] = useState<'damaged' | 'lost'>('damaged');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [foundItem, setFoundItem] = useState<[string, UniformItem] | null>(null);

  const handleLookup = () => {
    const entry = Object.entries(inventory).find(([_, item]) => item.barcode === barcode.trim());
    if (!entry) { setMessage({ type: 'error', text: `Barcode "${barcode}" not found` }); setFoundItem(null); return; }
    setFoundItem(entry);
    setMessage(null);
  };

  const handleMarkDamaged = async () => {
    if (!foundItem) return;
    const [itemKey, item] = foundItem;
    setLoading(true); setMessage(null);
    try {
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      const newStatus = damageType === 'damaged' ? 'Damaged' : 'Lost';
      updates[`inventory/${cityKey}/${itemKey}/status`] = newStatus;

      const damageKey = push(ref(db, `damages/${cityKey}`)).key;
      updates[`damages/${cityKey}/${damageKey}`] = {
        itemBarcode: item.barcode, itemName: item.name, damageType,
        reportedAt: timestamp, notes: notes.trim(), city: cityName, studio: studioName,
      };

      const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
      updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
        date: timestamp, action: damageType.toUpperCase(),
        details: `Marked ${item.name} (${item.barcode}) as ${newStatus}${notes ? ': ' + notes : ''}`,
      };

      await update(ref(db), updates);
      setMessage({ type: 'success', text: `✓ ${item.name} marked as ${newStatus}` });
      setBarcode(''); setNotes(''); setFoundItem(null);
      if (onRefresh) setTimeout(onRefresh, 500);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed. Please try again.' });
    } finally { setLoading(false); }
  };

  return (
    <div className="operation-content">
      <h3 className="step-title">Mark Item Damaged / Lost</h3>
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="damage-type-toggle">
        <button className={`damage-type-btn ${damageType === 'damaged' ? 'active-damage' : ''}`} onClick={() => setDamageType('damaged')}>
          🔧 Damaged
        </button>
        <button className={`damage-type-btn ${damageType === 'lost' ? 'active-lost' : ''}`} onClick={() => setDamageType('lost')}>
          ❓ Lost
        </button>
      </div>

      <BarcodeInput
        label="Item Barcode" placeholder="Scan or enter item barcode..."
        value={barcode} onChange={setBarcode} onSubmit={handleLookup} autoFocus
      />

      {foundItem && (
        <div className="found-item-card">
          <div className="found-item-name">{foundItem[1].name} — {foundItem[1].size}</div>
          <code className="barcode">{foundItem[1].barcode}</code>
          <span className={`status-badge status-${foundItem[1].status?.toLowerCase().replace(/\s+/g, '-')}`}>{foundItem[1].status}</span>
        </div>
      )}

      <div className="form-group">
        <label className="field-label">Notes (Optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Details about the damage or loss..."
          className="input-dark" rows={3} />
      </div>

      <button onClick={handleMarkDamaged} disabled={loading || !foundItem} className="btn btn-danger">
        {loading ? 'Processing...' : `Mark as ${damageType === 'damaged' ? 'Damaged' : 'Lost'}`}
      </button>
    </div>
  );
}
