import { useState, useRef, useEffect } from 'react';
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
  studios?: Record<string, Studio>;
  laundryEnabled?: boolean;
  onRefresh?: () => void;
}

export function Operations({ cityKey, cityName, studioKey, studioName, inventory, gps, studios = {}, laundryEnabled = true, onRefresh }: OperationsProps) {
  const [activeTab, setActiveTab] = useState<'issue' | 'return' | 'laundry' | 'damage'>('issue');

  const tabs = [
    { id: 'issue', label: 'Issue', icon: '📤' },
    { id: 'return', label: 'Return', icon: '📥' },
    ...(laundryEnabled ? [{ id: 'laundry', label: 'Laundry', icon: '🧺' }] : []),
    { id: 'damage', label: 'Damage / Lost', icon: '⚠️' },
  ] as const;

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
              title={tab.label}
            >
              <span className="ops-tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="tab-content">
        {activeTab === 'issue' && (
          <IssueOperation cityKey={cityKey} cityName={cityName} studioKey={studioKey} studioName={studioName} inventory={inventory} gps={gps} studios={studios} onRefresh={onRefresh} />
        )}
        {activeTab === 'return' && (
          <ReturnOperation cityKey={cityKey} cityName={cityName} studioKey={studioKey} studioName={studioName} inventory={inventory} studios={studios} laundryEnabled={laundryEnabled} onRefresh={onRefresh} />
        )}
        {activeTab === 'laundry' && laundryEnabled && (
          <LaundryOperation cityKey={cityKey} cityName={cityName} studioKey={studioKey} studioName={studioName} inventory={inventory} onRefresh={onRefresh} />
        )}
        {activeTab === 'damage' && (
          <DamageOperation cityKey={cityKey} cityName={cityName} studioKey={studioKey} studioName={studioName} inventory={inventory} onRefresh={onRefresh} />
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
          <div className="step-circle">
            {i < current ? '✓' : i + 1}
          </div>
          <span className="step-label">{label}</span>
          {i < steps.length - 1 && <div className="step-line" />}
        </div>
      ))}
    </div>
  );
}

// ─── BARCODE INPUT ────────────────────────────────────────────────────────────
// Works with USB scanners (which act as keyboard) and manual entry.

function BarcodeInput({
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  disabled,
  autoFocus,
  hint,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

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
          onKeyDown={e => {
            if (e.key === 'Enter') onSubmit();
          }}
          placeholder={placeholder}
          className="input-dark barcode-field"
          disabled={disabled}
          autoFocus={autoFocus}
        />
        <button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="btn btn-gold btn-scan"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

// ─── ISSUE OPERATION ──────────────────────────────────────────────────────────

type IssueStep = 'gp' | 'items' | 'reason' | 'confirm';

interface OperationComponentProps {
  cityKey: string;
  cityName: string;
  studioKey: string;
  studioName: string;
  inventory: Record<string, UniformItem>;
  gps?: Record<string, GamePresenter>;
  studios?: Record<string, Studio>;
  laundryEnabled?: boolean;
  onRefresh?: () => void;
}

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
  const [targetStudioKey, setTargetStudioKey] = useState(studioKey);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const studioList = Object.entries(studios).map(([key, s]) => ({ key, name: s.name }));
  const gpList = gps ? Object.entries(gps).map(([key, gp]) => ({ key, ...gp })) : [];

  const filteredGPs = gpSearch
    ? gpList.filter(gp => gp.name.toLowerCase().includes(gpSearch.toLowerCase()) || (gp.barcode || '').includes(gpSearch))
    : gpList;

  const handleGPLookup = () => {
    const found = gpList.find(gp => gp.barcode === gpSearch.trim() || gp.name.toLowerCase() === gpSearch.trim().toLowerCase());
    if (found) {
      setSelectedGP({ name: found.name, barcode: found.barcode || '', key: found.key });
      setIsNewGP(false);
      setStep('items');
    } else if (gpSearch.trim()) {
      // Not found — prompt to add
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
          itemBarcode: item.barcode,
          itemName: item.name,
          itemSize: item.size,
          gpName: selectedGP.name,
          gpBarcode: selectedGP.barcode,
          issuedAt: timestamp,
          issuedAtStudio: targetStudioKey,
          issuedAtCity: cityKey,
          issuedBy: CURRENT_USER,
          issueReason,
          status: 'active',
          city: cityName,
          studio: targetStudioName,
        };
      }

      // Save new GP if applicable
      if (!selectedGP.key) {
        const gpKey = push(ref(db, `gamePresenters/${cityKey}`)).key;
        updates[`gamePresenters/${cityKey}/${gpKey}`] = {
          name: selectedGP.name,
          barcode: selectedGP.barcode,
          city: cityName,
          studio: targetStudioName,
        };
      }

      const logKey = push(ref(db, `logs/${cityKey}/${targetStudioKey}`)).key;
      const reasonLabel = ISSUE_REASONS.find(r => r.value === issueReason)?.label || issueReason;
      updates[`logs/${cityKey}/${targetStudioKey}/${logKey}`] = {
        date: timestamp,
        action: 'ISSUE',
        details: `Issued ${selectedItems.length} item(s) to ${selectedGP.name} — Reason: ${reasonLabel} — Items: ${selectedItems.map(s => s.item.name).join(', ')}`,
      };

      await update(ref(db), updates);
      setMessage({ type: 'success', text: `✓ Issued ${selectedItems.length} item(s) to ${selectedGP.name}` });

      // Reset
      setTimeout(() => {
        setStep('gp');
        setGpSearch('');
        setSelectedGP(null);
        setSelectedItems([]);
        setIssueReason('');
        setItemBarcode('');
        setMessage(null);
        if (onRefresh) onRefresh();
      }, 2000);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to issue items. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="operation-content">
      <StepIndicator steps={['Identify GP', 'Scan Items', 'Reason', 'Confirm']} current={['gp','items','reason','confirm'].indexOf(step)} />

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
            <button onClick={() => setStep('confirm')} disabled={!issueReason} className="btn btn-gold">
              Next — Review →
            </button>
            <button onClick={() => setStep('items')} className="btn btn-dark">← Back</button>
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
              <span className="confirm-value">{ISSUE_REASONS.find(r => r.value === issueReason)?.label}</span>
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