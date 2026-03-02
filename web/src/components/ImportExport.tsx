import { useState, useRef } from 'react';
import { ref, update, push, get } from 'firebase/database';
import { db } from '../firebase';
import { UploadCloud, DownloadCloud } from 'lucide-react';
import type { UniformItem, Assignment, LaundryOrder, LogEntry, GamePresenter } from '../types';
import './ImportExport.css';

interface ImportExportProps {
  cityKey: string;
  cityName: string;
  studioKey: string;
  studioName: string;
  inventory: Record<string, UniformItem>;
  assignments: Record<string, Assignment>;
  laundryOrders: Record<string, LaundryOrder>;
  logs: Record<string, LogEntry>;
  gamePresenters: Record<string, GamePresenter>;
  currentUser?: string;
}

type ImportType = 'inventory' | 'gp';

const VALID_STATUSES = ['Available', 'In Stock', 'Issued', 'In Hamper', 'At Laundry', 'Damaged', 'Lost'];

function normalizeStatus(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'Available';
  const found = VALID_STATUSES.find(s => s.toLowerCase() === trimmed.toLowerCase());
  if (found === 'In Stock') return 'Available';
  return found || 'Available';
}

function toDateInput(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ─── CSV HELPERS ──────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: string[][]): void {
  const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map(r => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ' '));
  const rows = lines.slice(1).map(line => {
    const cols = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cols[i] || '').trim(); });
    return row;
  }).filter(r => Object.values(r).some(v => v));
  return { headers, rows };
}

// ─── PREVIEW TABLE ────────────────────────────────────────────────────────────

function PreviewTable({ headers, rows, errors }: { headers: string[]; rows: Record<string, string>[]; errors: string[] }) {
  return (
    <div className="preview-section">
      <div className="preview-meta">
        <span className="preview-count">{rows.length} rows detected</span>
        {errors.length > 0 && <span className="preview-errors">{errors.length} issues found</span>}
      </div>
      {errors.length > 0 && (
        <ul className="error-list">
          {errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
          {errors.length > 5 && <li>...and {errors.length - 5} more</li>}
        </ul>
      )}
      {rows.length > 0 && (
        <div className="preview-table-wrap">
          <table className="table-dark preview-table">
            <thead>
              <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row, i) => (
                <tr key={i}>{headers.map(h => <td key={h}>{row[h]}</td>)}</tr>
              ))}
              {rows.length > 5 && (
                <tr><td colSpan={headers.length} className="preview-more">...{rows.length - 5} more rows</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── GP HELPERS ──────────────────────────────────────────────────────────────

/** Extract flat { gpKey: GamePresenter } for a city from the (possibly nested) gamePresenters map. */
function flatCityGPs(gamePresenters: Record<string, GamePresenter>, cityKey: string): Record<string, GamePresenter> {
  const citySlice = (gamePresenters as any)[cityKey];
  if (citySlice && typeof citySlice === 'object' && Object.values(citySlice).some((v: any) => v?.name)) {
    return citySlice as Record<string, GamePresenter>;
  }
  return gamePresenters;
}

// ─── IMPORT PANEL ─────────────────────────────────────────────────────────────

function ImportPanel({ cityKey, cityName, studioKey, studioName, inventory, gamePresenters, currentUser }: {
  cityKey: string; cityName: string; studioKey: string; studioName: string;
  inventory: Record<string, UniformItem>;
  gamePresenters: Record<string, GamePresenter>;
  currentUser?: string;
}) {
  const [importType, setImportType] = useState<ImportType>('inventory');
  const [file, setFile] = useState<File | null>(null);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number; skippedRows: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setParseErrors([]);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const { headers, rows } = parseCSV(text);
      setParsedHeaders(headers);
      setParsedRows(rows);

      const errors: string[] = [];
      if (importType === 'inventory') {
        if (!headers.includes('item') && !headers.includes('name')) errors.push('Missing required column: ITEM or NAME');
        if (!headers.includes('size')) errors.push('Missing required column: SIZE');
        if (!headers.includes('barcode')) errors.push('Missing required column: BARCODE');
      } else {
        if (!headers.includes('dealer') && !headers.includes('name')) errors.push('Missing required column: Dealer or Name');
        if (!headers.includes('id card') && !headers.includes('barcode')) errors.push('Missing required column: ID card or Barcode');
      }
      setParseErrors(errors);
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!cityKey || !cityKey.trim()) { setParseErrors(['No city selected — please select a City from the sidebar first']); return; }
    if (parseErrors.length > 0 || parsedRows.length === 0) return;
    setLoading(true);
    setResult(null);

    try {
      const updates: Record<string, any> = {};
      let added = 0;
      const skipped: string[] = [];

      if (importType === 'inventory') {
        const existingBarcodes = new Set(Object.values(inventory).map(i => i.barcode));
        const batchBarcodes = new Set<string>();

        for (let i = 0; i < parsedRows.length; i++) {
          const row = parsedRows[i];
          const name = row['item'] || row['name'] || '';
          const size = row['size'] || '';
          const barcode = row['barcode'] || '';
          const status = normalizeStatus(row['status'] || '');
          const category = row['category'] || 'Other';
          const studio = row['studio'] || row['studiolocation'] || studioName;

          if (!name || !size || !barcode) { skipped.push(`Row ${i + 2}: missing name/size/barcode`); continue; }
          if (existingBarcodes.has(barcode) || batchBarcodes.has(barcode)) { skipped.push(`Row ${i + 2}: duplicate barcode "${barcode}"`); continue; }

          batchBarcodes.add(barcode);
          const newKey = push(ref(db, `inventory/${cityKey}`)).key!;
          updates[`inventory/${cityKey}/${newKey}`] = { name, size, barcode, status, category, studioLocation: studio };
          added++;
        }

        if (added > 0) {
          const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
          updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
            date: new Date().toISOString(), action: 'IMPORT', user: currentUser || 'Unknown User',
            details: `Imported ${added} inventory item(s) to ${cityName}`,
          };
        }
      } else {
        // Get city-scoped GP flat map (gamePresenters may be nested by cityKey)
        const cityGPsFlat = flatCityGPs(gamePresenters, cityKey);

        // Map existing ID cards → { gpKey, gp } for duplicate / re-activation checks
        const existingByBarcode = new Map<string, { key: string; gp: GamePresenter }>();
        Object.entries(cityGPsFlat).forEach(([k, v]) => {
          if (v?.barcode) existingByBarcode.set(v.barcode, { key: k, gp: v });
        });
        const batchIds = new Set<string>();

        for (let i = 0; i < parsedRows.length; i++) {
          const row = parsedRows[i];
          const name = row['dealer'] || row['name'] || '';
          const idCard = row['id card'] || row['barcode'] || '';

          if (!name || !idCard) { skipped.push(`Row ${i + 2}: missing name or ID card`); continue; }
          if (batchIds.has(idCard)) { skipped.push(`Row ${i + 2}: duplicate ID card "${idCard}"`); continue; }

          if (existingByBarcode.has(idCard)) {
            const existing = existingByBarcode.get(idCard)!;
            if (existing.gp.terminated) {
              // Re-activate a previously terminated GP
              updates[`gamePresenters/${cityKey}/${existing.key}/terminated`] = false;
              updates[`gamePresenters/${cityKey}/${existing.key}/terminatedAt`] = null;
              added++;
            } else {
              skipped.push(`Row ${i + 2}: duplicate ID card "${idCard}"`);
            }
            continue;
          }

          batchIds.add(idCard);
          const gpKey = push(ref(db, `gamePresenters/${cityKey}`)).key!;
          updates[`gamePresenters/${cityKey}/${gpKey}`] = { name, barcode: idCard, city: cityName, studio: studioName };
          added++;
        }
      }

      if (Object.keys(updates).length > 0) await update(ref(db), updates);

      setResult({ added, skipped: skipped.length, skippedRows: skipped });

      if (skipped.length > 0) {
        downloadCSV(`skipped_rows_${Date.now()}.csv`, [
          ['Row', 'Reason'],
          ...skipped.map(s => {
            const [rowPart, ...rest] = s.split(':');
            return [rowPart.replace('Row ', ''), rest.join(':').trim()];
          }),
        ]);
      }

      if (fileRef.current) fileRef.current.value = '';
      setFile(null);
      setParsedRows([]);
      setParsedHeaders([]);
    } catch (err) {
      console.error('Import error', err);
      setParseErrors([`Import failed: ${String(err)}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="import-content">
      <h3>Import Data</h3>

      <div className="import-type-selector tabs modern-tabs">
        {[
          { id: 'inventory', label: 'Inventory Items', icon: '📦' },
          { id: 'gp', label: 'Game Presenters', icon: '🪪' },
        ].map(tab => {
          const isActive = importType === tab.id;
          return (
            <button
              key={tab.id}
              className={`import-type-btn modern-tab ${isActive ? 'active' : ''}`}
              onClick={() => { setImportType(tab.id as any); setFile(null); setParsedRows([]); setResult(null); if (fileRef.current) fileRef.current.value = ''; }}
              type="button"
            >
              <span className="import-type-icon">{tab.icon}</span>
              <div>
                <strong>{tab.label}</strong>
                <small>{tab.id === 'inventory' ? 'ITEM, SIZE, BARCODE, STATUS, City, Studio' : 'Dealer, ID card'}</small>
              </div>
            </button>
          );
        })}
      </div>

      <div className="format-hint">
        {importType === 'inventory' ? (
          <>
            <strong>Required columns:</strong> ITEM, SIZE, BARCODE<br />
            <strong>Optional:</strong> STATUS (default: Available), City, Studio (default: current)<br />
            <strong>Valid statuses:</strong> Available, Issued, In Hamper, At Laundry, Damaged, Lost
          </>
        ) : (
          <>
            <strong>Required columns:</strong> Dealer, ID card<br />
            Duplicates by ID card are skipped automatically.
          </>
        )}
      </div>

      <div className="form-group">
        <label className="field-label">Select CSV File</label>
        <input type="file" accept=".csv,.txt" onChange={handleFileChange} className="file-input" ref={fileRef} />
      </div>

      {parsedRows.length > 0 && <PreviewTable headers={parsedHeaders} rows={parsedRows} errors={parseErrors} />}

      {result && (
        <div className={`import-result ${result.skipped > 0 ? 'partial' : 'success'}`}>
          <div className="result-stat"><span className="result-num">{result.added}</span> rows imported</div>
          {result.skipped > 0 && (
            <div className="result-stat">
              <span className="result-num warn">{result.skipped}</span> skipped
              <small>(skipped rows downloaded as CSV)</small>
            </div>
          )}
        </div>
      )}

      {file && parsedRows.length > 0 && (
        <div className="button-group">
          <button onClick={handleImport} disabled={loading || parseErrors.length > 0} className="btn btn-gold">
            {loading ? 'Importing...' : `Import ${parsedRows.length} Rows`}
          </button>
          <button onClick={() => { setFile(null); setParsedRows([]); setResult(null); if (fileRef.current) fileRef.current.value = ''; }} className="btn btn-dark">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

// ─── EXPORT PANEL ─────────────────────────────────────────────────────────────

function ExportPanel({ cityKey, cityName, studioName, inventory, assignments, laundryOrders, gamePresenters }: {
  cityKey: string;
  cityName: string;
  studioName: string;
  inventory: Record<string, UniformItem>;
  assignments: Record<string, Assignment>;
  laundryOrders: Record<string, LaundryOrder>;
  gamePresenters: Record<string, GamePresenter>;
}) {
  const today = toDateInput(new Date());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(today); // default end = today
  const [statusFilter, setStatusFilter] = useState('all');
  const [logLoading, setLogLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditYear, setAuditYear] = useState('');
  const [auditWeek, setAuditWeek] = useState('');
  const [auditOptions, setAuditOptions] = useState<{ year: string; week: string; label: string }[]>([]);
  const [auditOptionsLoaded, setAuditOptionsLoaded] = useState(false);

  const dateSuffix = `${cityName}_${studioName}_${today}`;

  // ── Preset helpers ────────────────────────────────────────────────────────
  const applyPreset = (days: number | 'today') => {
    const end = new Date();
    const start = new Date();
    if (days === 'today') {
      setDateFrom(toDateInput(end));
    } else {
      start.setDate(start.getDate() - days);
      setDateFrom(toDateInput(start));
    }
    setDateTo(toDateInput(end));
  };

  const filterByDate = <T extends { issuedAt?: string; date?: string }>(items: T[]) => {
    return items.filter(item => {
      const d = new Date(item.issuedAt || item.date || '');
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  };

  // ── Export functions ──────────────────────────────────────────────────────
  const exportInventory = () => {
    let items = Object.values(inventory);
    if (statusFilter !== 'all') items = items.filter(i => i.status === statusFilter);
    downloadCSV(`inventory_${dateSuffix}.csv`, [
      ['Name', 'Size', 'Barcode', 'Status', 'Category', 'Studio Location', 'Issued At', 'Issued At Studio', 'Issued By', 'Returned At', 'Returned At Studio'],
      ...items.map(i => [
        i.name, i.size, i.barcode, i.status, i.category, i.studioLocation,
        i.issuedAt || '', i.issuedAtStudio || '', i.issuedBy || '',
        i.returnedAt || '', i.returnedAtStudio || '',
      ]),
    ]);
  };

  const exportIssuedItems = () => {
    const issued = Object.values(assignments);
    const filtered = dateFrom || dateTo ? filterByDate(issued) : issued;
    downloadCSV(`issued_items_${dateSuffix}.csv`, [
      ['GP Name', 'GP ID Card', 'Item Name', 'Size', 'Item Barcode', 'Issued At', 'Issued At Studio', 'Issue Reason', 'Issued By', 'Returned At', 'Returned At Studio', 'Returned By', 'Status'],
      ...filtered.map(a => [
        a.gpName, a.gpBarcode || '', a.itemName, a.itemSize, a.itemBarcode,
        a.issuedAt, a.issuedAtStudio, (a as any).issueReason || '',
        (a as any).issuedBy || '',
        a.returnedAt || '', a.returnedAtStudio || '',
        (a as any).returnedBy || '', a.status,
      ]),
    ]);
  };

  const exportLoaners = () => {
    const loaners = Object.values(assignments).filter(a => (a as any).issueReason === 'loaner');
    const filtered = dateFrom || dateTo ? filterByDate(loaners) : loaners;
    const loanerReasonLabel = (r: string) =>
      r === 'forgot' ? 'Forgot Uniform' : r === 'pit_change' ? 'Pit Was Changed' : r || '';

    downloadCSV(`loaners_${dateSuffix}.csv`, [
      ['GP Name', 'GP ID Card', 'Item Name', 'Size', 'Item Barcode', 'Issued At', 'Studio', 'Loaner Reason', 'Issued By', 'Status', 'Returned At', 'Returned By'],
      ...filtered.map(a => [
        a.gpName, a.gpBarcode || '', a.itemName, a.itemSize, a.itemBarcode,
        a.issuedAt, a.studio || '', loanerReasonLabel((a as any).loanerReason || ''),
        (a as any).issuedBy || '',
        a.status, a.returnedAt || '',
        (a as any).returnedBy || '',
      ]),
    ]);
  };

  const exportLaundry = () => {
    downloadCSV(`laundry_orders_${dateSuffix}.csv`, [
      ['Order Number', 'Created At', 'Created By', 'Picked Up At', 'Returned At', 'Status', 'Item Count', 'Barcodes'],
      ...Object.values(laundryOrders).map(o => [
        o.orderNumber, o.createdAt, (o as any).createdBy || '',
        o.pickedUpAt || '', o.returnedAt || '',
        o.status, String(o.itemCount), (o.items || []).join('; '),
      ]),
    ]);
  };

  // Activity log: fetch ALL studios for this city directly from Firebase
  const exportLogs = async () => {
    setLogLoading(true);
    try {
      const snap = await get(ref(db, `logs/${cityKey}`));
      const cityLogs = snap.val() || {};

      // Flatten: logs/${cityKey}/${studioKey}/${logKey} → LogEntry
      const allEntries: Array<{ date: string; action: string; details: string; studio?: string }> = [];
      for (const [studioKey, studioDB] of Object.entries(cityLogs)) {
        if (typeof studioDB !== 'object' || !studioDB) continue;
        for (const entry of Object.values(studioDB as Record<string, any>)) {
          if (entry && entry.date) {
            allEntries.push({ ...entry, studio: studioKey });
          }
        }
      }

      let filtered = allEntries;
      if (dateFrom || dateTo) {
        filtered = allEntries.filter(e => {
          const d = new Date(e.date);
          if (dateFrom && d < new Date(dateFrom)) return false;
          if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
          return true;
        });
      }

      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      downloadCSV(`activity_logs_${dateSuffix}.csv`, [
        ['Date', 'Action', 'Details', 'Studio', 'User'],
        ...filtered.map(l => [l.date, l.action, l.details, l.studio || '', (l as any).user || '']),
      ]);
    } catch (err) {
      console.error('Log export failed', err);
    } finally {
      setLogLoading(false);
    }
  };

  const loadAuditOptions = async () => {
    if (auditOptionsLoaded) return;
    try {
      const snap = await get(ref(db, `audit_sessions/${cityKey}`));
      const cityData = snap.val() || {};
      const optMap = new Map<string, string>();
      for (const studioSessions of Object.values(cityData)) {
        if (typeof studioSessions !== 'object' || !studioSessions) continue;
        for (const session of Object.values(studioSessions as Record<string, any>)) {
          if (!session?.completedAt) continue;
          const d = new Date(session.completedAt);
          const year = String(d.getFullYear());
          const week = String(getISOWeek(d)).padStart(2, '0');
          const key = `${year}-W${week}`;
          if (!optMap.has(key)) {
            optMap.set(key, `${year} — Week ${week}`);
          }
        }
      }
      const opts = Array.from(optMap.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([key, label]) => {
          const [year, weekPart] = key.split('-W');
          return { year, week: weekPart, label };
        });
      setAuditOptions(opts);
      if (opts.length > 0 && !auditYear) {
        setAuditYear(opts[0].year);
        setAuditWeek(opts[0].week);
      }
    } catch (err) {
      console.error('Failed to load audit options', err);
    }
    setAuditOptionsLoaded(true);
  };

  const exportAuditResults = async () => {
    if (!auditYear || !auditWeek) return;
    setAuditLoading(true);
    try {
      const snap = await get(ref(db, `audit_sessions/${cityKey}`));
      const cityData = snap.val() || {};
      const rows: string[][] = [
        ['Completed At', 'Week', 'Studio', 'Audited By', 'Category', 'Size', 'Expected', 'Found', 'Missing', 'Unexpected', 'Variance %', 'Risk Score', 'Reasons',
          'Found / Accounted For', 'Uniform Holding (Missing)', 'Laundry', 'Damaged / Lost', 'Terminated GP Holding'],
      ];
      for (const [sk, studioSessions] of Object.entries(cityData)) {
        if (typeof studioSessions !== 'object' || !studioSessions) continue;
        for (const session of Object.values(studioSessions as Record<string, any>)) {
          if (!session?.completedAt) continue;
          const d = new Date(session.completedAt);
          const sYear = String(d.getFullYear());
          const sWeek = String(getISOWeek(d)).padStart(2, '0');
          if (sYear !== auditYear || sWeek !== auditWeek) continue;
          const shrinkMap: Record<string, number> = {};
          if (Array.isArray(session.shrinkageData)) {
            for (const sl of session.shrinkageData) {
              if (sl && typeof sl.label === 'string' && typeof sl.count === 'number') {
                shrinkMap[sl.label] = sl.count;
              }
            }
          }
          const shrinkRow = [
            String(shrinkMap['Found / Accounted For'] ?? ''),
            String(shrinkMap['Uniform Holding (Missing)'] ?? ''),
            String(shrinkMap['Laundry'] ?? ''),
            String(shrinkMap['Damaged / Lost'] ?? ''),
            String(shrinkMap['Terminated GP Holding'] ?? ''),
          ];
          if (Array.isArray(session.results) && session.results.length > 0) {
            for (const r of session.results) {
              rows.push([
                session.completedAt, session.week || '', session.studio || sk,
                session.auditedBy || '',
                r.category || '', r.size || '',
                String(r.expected ?? ''), String(r.found ?? ''), String(r.missing ?? ''), String(r.unexpected ?? ''),
                String(r.variancePct ?? ''), String(r.score ?? ''), (r.reasons || []).join(' + '),
                ...shrinkRow,
              ]);
            }
          } else {
            rows.push([
              session.completedAt, session.week || '', session.studio || sk,
              session.auditedBy || '',
              '', '', '', '', '', '', '', '', '',
              ...shrinkRow,
            ]);
          }
        }
      }
      downloadCSV(`audit_results_${cityName}_${auditYear}_W${auditWeek}.csv`, rows);
    } catch (err) {
      console.error('Audit export failed', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const exportGPs = () => {
    const cityGPsFlat = flatCityGPs(gamePresenters, cityKey);
    downloadCSV(`game_presenters_${dateSuffix}.csv`, [
      ['Name', 'ID Card', 'City', 'Studio', 'Status'],
      ...Object.values(cityGPsFlat).map(gp => [
        gp.name, gp.barcode || '', gp.city || '', gp.studio || '',
        gp.terminated ? 'Terminated' : 'Active',
      ]),
    ]);
  };

  const exportTerminatedOutstanding = () => {
    const cityGPsFlat = flatCityGPs(gamePresenters, cityKey);
    const terminatedBarcodes = new Set<string>();
    const terminatedNames = new Set<string>();
    Object.values(cityGPsFlat).forEach(gp => {
      if (gp.terminated) {
        if (gp.barcode) terminatedBarcodes.add(gp.barcode);
        terminatedNames.add((gp.name || '').toLowerCase());
      }
    });
    const outstanding = Object.values(assignments).filter(a =>
      a.status === 'active' && (
        (a.gpBarcode && terminatedBarcodes.has(a.gpBarcode)) ||
        terminatedNames.has((a.gpName || '').toLowerCase())
      )
    );
    const now = Date.now();
    downloadCSV(`terminated_gp_outstanding_${dateSuffix}.csv`, [
      ['GP Name', 'GP ID Card', 'Item Name', 'Size', 'Item Barcode', 'Issued At', 'Issued At Studio', 'Days Outstanding'],
      ...outstanding.map(a => {
        const issuedMs = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
        const daysOut = issuedMs ? String(Math.floor((now - issuedMs) / 86400000)) : '';
        return [a.gpName, a.gpBarcode || '', a.itemName, a.itemSize, a.itemBarcode,
          a.issuedAt, a.issuedAtStudio, daysOut];
      }),
    ]);
  };

  const exportCards = [
    {
      icon: '📦', title: 'Inventory', desc: 'All items with status, barcode, and tracking fields',
      action: exportInventory,
      extra: (
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-dark input-sm">
          <option value="all">All statuses</option>
          {['Available', 'Issued', 'In Hamper', 'At Laundry', 'Damaged', 'Lost'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      ),
    },
    {
      icon: '📋', title: 'Issue History', desc: 'All issue/return records with GP info and reasons',
      action: exportIssuedItems, extra: null,
    },
    {
      icon: '🔄', title: 'Loaners', desc: 'Active and past loaners with reason (Forgot / Pit Changed)',
      action: exportLoaners, extra: null,
    },
    {
      icon: '🧺', title: 'Laundry Orders', desc: 'All laundry pickups and returns',
      action: exportLaundry, extra: null,
    },
    {
      icon: '📜', title: 'Activity Log', desc: 'All system events across all studios in this city',
      action: exportLogs, loading: logLoading,
    },
    {
      icon: '🔍', title: 'Audit Results', desc: 'Historical CAO audit results with shrinkage breakdown',
      action: exportAuditResults, loading: auditLoading,
      extra: (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.25rem' }}
          onClick={e => e.stopPropagation()}
          onMouseEnter={loadAuditOptions}
        >
          <select
            value={auditYear}
            onChange={e => { setAuditYear(e.target.value); setAuditWeek(''); }}
            className="input-dark input-sm"
            style={{ minWidth: '80px' }}
          >
            {!auditOptionsLoaded && <option value="">Year…</option>}
            {Array.from(new Set(auditOptions.map(o => o.year))).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={auditWeek}
            onChange={e => setAuditWeek(e.target.value)}
            className="input-dark input-sm"
            style={{ minWidth: '100px' }}
          >
            {!auditYear && <option value="">Week…</option>}
            {auditOptions.filter(o => o.year === auditYear).map(o => (
              <option key={o.week} value={o.week}>Week {o.week}</option>
            ))}
          </select>
        </div>
      ),
    },
    {
      icon: '🪪', title: 'Game Presenters', desc: 'Full GP list with ID cards and active/terminated status',
      action: exportGPs, extra: null,
    },
    {
      icon: '⚠️', title: 'Terminated GP Outstanding', desc: 'Uniforms still held by terminated GPs',
      action: exportTerminatedOutstanding, extra: null,
    },
  ];

  return (
    <div className="export-content">
      <h3>Export Data</h3>

      {/* Date range + presets */}
      <div className="export-date-section">
        <div className="date-preset-row">
          <span className="field-label" style={{ marginBottom: 0 }}>Quick range:</span>
          <button className="btn-preset" onClick={() => applyPreset('today')}>Today</button>
          <button className="btn-preset" onClick={() => applyPreset(7)}>Last 7 Days</button>
          <button className="btn-preset" onClick={() => applyPreset(30)}>Last 30 Days</button>
          {(dateFrom || dateTo !== today) && (
            <button className="btn-preset btn-preset-clear" onClick={() => { setDateFrom(''); setDateTo(today); }}>
              ✕ Clear
            </button>
          )}
        </div>
        <div className="date-range-group">
          <div className="form-group">
            <label className="field-label">From Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-dark" />
          </div>
          <div className="form-group">
            <label className="field-label">To Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-dark" />
          </div>
        </div>
        {(dateFrom || dateTo) && (
          <p className="export-date-hint">
            Filtering: {dateFrom || 'all time'} → {dateTo || 'today'}
            {' '}(applies to Issue History, Loaners, and Activity Log)
          </p>
        )}
      </div>

      <div className="export-cards">
        {exportCards.map(card => (
          <div key={card.title} className="export-card">
            <div className="export-card-left">
              <span className="export-card-icon">{card.icon}</span>
              <div>
                <strong>{card.title}</strong>
                <p className="export-card-desc">{card.desc}</p>
                {card.extra && <div className="export-card-extra">{card.extra}</div>}
              </div>
            </div>
            <button
              onClick={card.action}
              className="btn btn-dark"
              disabled={(card as any).loading}
            >
              {(card as any).loading ? '…' : '↓ CSV'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function ImportExport({ cityKey, cityName, studioKey, studioName, inventory, assignments, laundryOrders, gamePresenters, currentUser }: ImportExportProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');

  return (
    <div className="import-export-container card">
      <h2 className="text-accent">Import / Export</h2>

      <div className="ie-tabs tabs modern-tabs">
        {[
          { id: 'import', label: 'Import', icon: UploadCloud },
          { id: 'export', label: 'Export', icon: DownloadCloud },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`ie-tab tab modern-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
              type="button"
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="tab-content">
        {activeTab === 'import' && (
          <ImportPanel cityKey={cityKey} cityName={cityName} studioKey={studioKey} studioName={studioName}
            inventory={inventory} gamePresenters={gamePresenters} currentUser={currentUser} />
        )}
        {activeTab === 'export' && (
          <ExportPanel
            cityKey={cityKey}
            cityName={cityName}
            studioName={studioName}
            inventory={inventory}
            assignments={assignments}
            laundryOrders={laundryOrders}
            gamePresenters={gamePresenters}
          />
        )}
      </div>
    </div>
  );
}

export default ImportExport;
