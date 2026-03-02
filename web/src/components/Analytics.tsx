import { useState, useMemo, useRef } from 'react';
import { ref, update, push, get } from 'firebase/database';
import { db } from '../firebase';
import { BarChart3, PieChart, Clock, Zap } from 'lucide-react';
import type { Assignment, UniformItem, GPIssueSummary, ItemDemandSummary, ItemLifespanSummary } from '../types';
import './Analytics.css';

interface AnalyticsProps {
  cityKey: string;
  cityName: string;
  studioKey: string;
  studioName: string;
  inventory: Record<string, UniformItem>;
  assignments: Record<string, Assignment>;
}

export function Analytics({ cityKey, cityName, studioKey, studioName, inventory, assignments }: AnalyticsProps) {
  const [activeTab, setActiveTab] = useState<'gp-report' | 'demand' | 'lifespan' | 'audit'>('gp-report');

  return (
    <div className="analytics-container card">
      <h2 className="text-accent">Analytics &amp; Reports</h2>
      <p className="text-muted">Studio-scoped analytics for {studioName}</p>
      
      <div className="tabs modern-tabs">
        {[
          { id: 'gp-report', label: 'GP Issues', icon: BarChart3 },
          { id: 'demand', label: 'Demand by Size', icon: PieChart },
          { id: 'lifespan', label: 'Item Lifespan', icon: Clock },
          { id: 'audit', label: 'Smart Audit', icon: Zap },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`tab modern-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
              type="button"
              aria-pressed={isActive}
              title={tab.label}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="tab-content">
        {activeTab === 'gp-report' && (
          <GPIssueReport
            cityKey={cityKey}
            studioKey={studioKey}
            studioName={studioName}
            assignments={assignments}
          />
        )}
        {activeTab === 'demand' && (
          <DemandAnalysis
            cityKey={cityKey}
            studioKey={studioKey}
            studioName={studioName}
            assignments={assignments}
          />
        )}
        {activeTab === 'lifespan' && (
          <LifespanAnalysis
            cityKey={cityKey}
            studioKey={studioKey}
            studioName={studioName}
            inventory={inventory}
            assignments={assignments}
          />
        )}
        {activeTab === 'audit' && (
          <UnifiedAudit
            cityKey={cityKey}
            cityName={cityName}
            studioKey={studioKey}
            studioName={studioName}
            inventory={inventory}
            assignments={assignments}
          />
        )}
      </div>
    </div>
  );
}

interface AnalyticsComponentProps {
  cityKey: string;
  studioKey: string;
  studioName: string;
  assignments: Record<string, Assignment>;
  inventory?: Record<string, UniformItem>;
  cityName?: string;
}

// GP Issue Report Component
function GPIssueReport({ studioName, assignments }: AnalyticsComponentProps) {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | 'custom'>('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'name'>('count');

  const gpSummaries = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    if (dateRange === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '30d') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      startDate = customStart ? new Date(customStart) : new Date(0);
    }

    const endDate = dateRange === 'custom' && customEnd ? new Date(customEnd) : now;

    // Filter assignments by studio and date range
    const filteredAssignments = Object.values(assignments).filter(
      (a) => a.studio === studioName && 
             new Date(a.issuedAt) >= startDate && 
             new Date(a.issuedAt) <= endDate
    );

    // Group by GP
    const gpMap = new Map<string, GPIssueSummary>();

    filteredAssignments.forEach((assignment) => {
      const gpKey = assignment.gpName;
      if (!gpMap.has(gpKey)) {
        gpMap.set(gpKey, {
          gpName: assignment.gpName,
          gpBarcode: assignment.gpBarcode,
          issueCount: 0,
          items: {},
        });
      }

      const summary = gpMap.get(gpKey)!;
      summary.issueCount++;
      summary.items[assignment.itemName] = (summary.items[assignment.itemName] || 0) + 1;
      
      // Track most recent issue
      if (!summary.lastIssued || new Date(assignment.issuedAt) > new Date(summary.lastIssued)) {
        summary.lastIssued = assignment.issuedAt;
      }
    });

    const summaries = Array.from(gpMap.values());

    // Sort
    if (sortBy === 'count') {
      summaries.sort((a, b) => b.issueCount - a.issueCount);
    } else {
      summaries.sort((a, b) => a.gpName.localeCompare(b.gpName));
    }

    return summaries;
  }, [assignments, studioName, dateRange, customStart, customEnd, sortBy]);

  const exportCSV = () => {
    let csv = 'GP Name,GP Barcode,Issue Count,Last Issued,Items\n';
    gpSummaries.forEach((summary) => {
      const itemsList = Object.entries(summary.items)
        .map(([name, count]) => `${name}(${count})`)
        .join('; ');
      csv += `${summary.gpName},${summary.gpBarcode || ''},${summary.issueCount},${summary.lastIssued || ''},${itemsList}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `gp_issues_${studioName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="analytics-section">
      <h3>Routinely Issued GPs Report</h3>
      <p className="text-muted">Game presenters who received uniforms in the selected period</p>

      <div className="analytics-controls">
        <div className="form-group">
          <label>Date Range</label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | 'custom')}
            className="input-dark"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {dateRange === 'custom' && (
          <>
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="input-dark"
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="input-dark"
              />
            </div>
          </>
        )}

        <div className="form-group">
          <label>Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'count' | 'name')}
            className="input-dark"
          >
            <option value="count">Issue Count</option>
            <option value="name">GP Name</option>
          </select>
        </div>

        <button onClick={exportCSV} className="btn btn-gold" disabled={gpSummaries.length === 0}>
          Export CSV
        </button>
      </div>

      {gpSummaries.length === 0 ? (
        <p className="text-muted">No issues found in the selected period</p>
      ) : (
        <div className="table-container">
          <table className="table-dark">
            <thead>
              <tr>
                <th>GP Name</th>
                <th>GP Barcode</th>
                <th>Issue Count</th>
                <th>Last Issued</th>
                <th>Items Issued</th>
              </tr>
            </thead>
            <tbody>
              {gpSummaries.map((summary, index) => (
                <tr key={index}>
                  <td>{summary.gpName}</td>
                  <td><code>{summary.gpBarcode || 'N/A'}</code></td>
                  <td><strong>{summary.issueCount}</strong></td>
                  <td>{summary.lastIssued ? new Date(summary.lastIssued).toLocaleDateString() : 'N/A'}</td>
                  <td className="items-cell">
                    {Object.entries(summary.items).map(([name, count]) => (
                      <span key={name} className="item-tag">
                        {name} ({count})
                      </span>
                    ))}
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

// Demand Analysis Component
function DemandAnalysis({ studioName, assignments }: AnalyticsComponentProps) {
  const [lookbackWeeks, setLookbackWeeks] = useState(4);
  const [safetyFactor, setSafetyFactor] = useState(1.5);
  const [filterCategory, setFilterCategory] = useState<string>('');

  const demandSummaries = useMemo(() => {
    const now = new Date();
    const startDate = new Date(now.getTime() - lookbackWeeks * 7 * 24 * 60 * 60 * 1000);

    // Filter assignments by studio and lookback period
    const filteredAssignments = Object.values(assignments).filter(
      (a) => a.studio === studioName && new Date(a.issuedAt) >= startDate
    );

    // Group by item name and size
    const demandMap = new Map<string, ItemDemandSummary>();

    filteredAssignments.forEach((assignment) => {
      const key = `${assignment.itemName}|${assignment.itemSize}`;
      if (!demandMap.has(key)) {
        demandMap.set(key, {
          itemName: assignment.itemName,
          size: assignment.itemSize,
          category: 'Unknown', // We don't have category in assignment
          totalIssued: 0,
          avgPerWeek: 0,
          suggestedStock: 0,
        });
      }

      const summary = demandMap.get(key)!;
      summary.totalIssued++;
    });

    // Calculate averages and suggestions
    const summaries = Array.from(demandMap.values()).map((summary) => ({
      ...summary,
      avgPerWeek: summary.totalIssued / lookbackWeeks,
      suggestedStock: Math.ceil((summary.totalIssued / lookbackWeeks) * safetyFactor),
    }));

    // Filter by category if selected
    const filtered = filterCategory
      ? summaries.filter((s) => s.category === filterCategory)
      : summaries;

    // Sort by total issued descending
    filtered.sort((a, b) => b.totalIssued - a.totalIssued);

    return filtered;
  }, [assignments, studioName, lookbackWeeks, safetyFactor, filterCategory]);

  const categories = useMemo(() => {
    const cats = new Set(demandSummaries.map((s) => s.category));
    return Array.from(cats);
  }, [demandSummaries]);

  const exportCSV = () => {
    let csv = 'Item Name,Size,Category,Total Issued,Avg Per Week,Suggested Stock\n';
    demandSummaries.forEach((summary) => {
      csv += `${summary.itemName},${summary.size},${summary.category},${summary.totalIssued},${summary.avgPerWeek.toFixed(2)},${summary.suggestedStock}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `demand_analysis_${studioName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="analytics-section">
      <h3>Items Needed by Size (Weekly Demand)</h3>
      <p className="text-muted">Analysis based on recent assignment history</p>

      <div className="analytics-controls">
        <div className="form-group">
          <label>Lookback Period (Weeks)</label>
          <input
            type="number"
            min="1"
            max="52"
            value={lookbackWeeks}
            onChange={(e) => setLookbackWeeks(parseInt(e.target.value, 10))}
            className="input-dark"
          />
        </div>

        <div className="form-group">
          <label>Safety Factor</label>
          <input
            type="number"
            min="1"
            max="3"
            step="0.1"
            value={safetyFactor}
            onChange={(e) => setSafetyFactor(parseFloat(e.target.value))}
            className="input-dark"
          />
        </div>

        <div className="form-group">
          <label>Filter by Category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input-dark"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <button onClick={exportCSV} className="btn btn-gold" disabled={demandSummaries.length === 0}>
          Export CSV
        </button>
      </div>

      {demandSummaries.length === 0 ? (
        <p className="text-muted">No demand data available for the selected period</p>
      ) : (
        <div className="table-container">
          <table className="table-dark">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Size</th>
                <th>Category</th>
                <th>Total Issued ({lookbackWeeks}w)</th>
                <th>Avg/Week</th>
                <th>Suggested Stock</th>
              </tr>
            </thead>
            <tbody>
              {demandSummaries.map((summary, index) => (
                <tr key={index}>
                  <td>{summary.itemName}</td>
                  <td>{summary.size}</td>
                  <td>{summary.category}</td>
                  <td><strong>{summary.totalIssued}</strong></td>
                  <td>{summary.avgPerWeek.toFixed(2)}</td>
                  <td className="text-accent"><strong>{summary.suggestedStock}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="analytics-info">
        <p className="text-muted">
          <strong>Note:</strong> Suggested stock = (Avg per week × Safety factor). 
          Adjust safety factor based on variability and business needs.
        </p>
      </div>
    </div>
  );
}

// Lifespan Analysis Component
function LifespanAnalysis({ inventory, assignments }: AnalyticsComponentProps & { inventory: Record<string, UniformItem> }) {
  const lifespanSummaries = useMemo(() => {
    // Get damaged/lost items
    const damagedItems = Object.values(inventory).filter(
      (item) => item.status === 'Damaged' || item.status === 'Lost'
    );

    // Group by item name (e.g. "Dress Shirt" — same as SmartAudit / SizeSuggestion)
    const categoryMap = new Map<string, number[]>();

    damagedItems.forEach((item) => {
      // Find the first assignment for this item
      const itemAssignments = Object.values(assignments).filter(
        (a) => a.itemBarcode === item.barcode
      ).sort((a, b) => new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime());

      if (itemAssignments.length > 0) {
        const firstIssue = new Date(itemAssignments[0].issuedAt);
        const now = new Date();
        const lifespanDays = Math.floor((now.getTime() - firstIssue.getTime()) / (1000 * 60 * 60 * 24));

        const key = getItemCategory(item); // uses item.name
        if (!categoryMap.has(key)) {
          categoryMap.set(key, []);
        }
        categoryMap.get(key)!.push(lifespanDays);
      }
    });

    // Calculate statistics per category
    const summaries: ItemLifespanSummary[] = [];

    categoryMap.forEach((lifespans, category) => {
      const sorted = lifespans.sort((a, b) => a - b);
      const sum = sorted.reduce((acc, val) => acc + val, 0);
      const avg = sum / sorted.length;
      const median = sorted.length > 0 
        ? sorted.length % 2 === 0 
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)]
        : 0;

      summaries.push({
        category,
        avgLifespanDays: Math.round(avg),
        medianLifespanDays: Math.round(median),
        sampleSize: sorted.length,
        minLifespanDays: sorted.length > 0 ? sorted[0] : 0,
        maxLifespanDays: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
      });
    });

    // Sort by sample size descending
    summaries.sort((a, b) => b.sampleSize - a.sampleSize);

    return summaries;
  }, [inventory, assignments]);

  const exportCSV = () => {
    let csv = 'Item Name,Avg Lifespan (Days),Median Lifespan (Days),Min,Max,Sample Size\n';
    lifespanSummaries.forEach((summary) => {
      csv += `${summary.category},${summary.avgLifespanDays},${summary.medianLifespanDays || 0},${summary.minLifespanDays || 0},${summary.maxLifespanDays || 0},${summary.sampleSize}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `lifespan_analysis_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="analytics-section">
      <h3>Average Item Lifespan by Item Name</h3>
      <p className="text-muted">Time from first issue to damaged/lost status, grouped by item name</p>

      <div className="analytics-controls">
        <button onClick={exportCSV} className="btn btn-gold" disabled={lifespanSummaries.length === 0}>
          Export CSV
        </button>
      </div>

      {lifespanSummaries.length === 0 ? (
        <p className="text-muted">No damaged/lost items with assignment history found</p>
      ) : (
        <div className="table-container">
          <table className="table-dark">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Avg Lifespan (Days)</th>
                <th>Median Lifespan (Days)</th>
                <th>Min</th>
                <th>Max</th>
                <th>Sample Size</th>
              </tr>
            </thead>
            <tbody>
              {lifespanSummaries.map((summary, index) => (
                <tr key={index}>
                  <td><strong>{summary.category}</strong></td>
                  <td className="text-accent">{summary.avgLifespanDays} days</td>
                  <td>{summary.medianLifespanDays || 'N/A'} days</td>
                  <td>{summary.minLifespanDays || 'N/A'}</td>
                  <td>{summary.maxLifespanDays || 'N/A'}</td>
                  <td>{summary.sampleSize}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="analytics-info">
        <p className="text-muted">
          <strong>Note:</strong> Lifespan is calculated from first issue to current date for damaged/lost items. 
          Larger sample sizes provide more reliable estimates.
        </p>
      </div>
    </div>
  );
}


// ─── HELPER: item name IS the category ─────────────────────────────────────
function getItemCategory(item: UniformItem): string {
  return item.name || (item as any).category || 'Other';
}

// ─── CAO SMART AUDIT SYSTEM ──────────────────────────────────────────────────
//
// Stage flow:
//   'generate'  → show risk formula, click "Generate This Week's Audit"
//   'scanning'  → scan one scope at a time, Next → advances through list
//   'results'   → full results table with variance %, risk score, reason tags
//

interface AuditScope {
  key: string;
  name: string;
  size: string;
  score: number;
  frequency: number;
  discrepancy: number;
  lastAuditedDays: number;
  reasons: string[];
  expectedBarcodes: string[];
}

interface AuditScopeResult extends AuditScope {
  scanned: string[];
  found: number;
  missing: number;
  unexpected: number;
  variancePct: number;
}

function getWeekString(): string {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  return `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function UnifiedAudit({ cityKey, cityName, studioKey, studioName, inventory, assignments }: AnalyticsComponentProps & { inventory: Record<string, UniformItem>; cityName: string }) {
  const [stage, setStage] = useState<'generate' | 'scanning' | 'results'>('generate');
  const [scopes, setScopes] = useState<AuditScope[]>([]);
  const [scopeIndex, setScopeIndex] = useState(0);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [currentScanned, setCurrentScanned] = useState<string[]>([]);
  const [completedResults, setCompletedResults] = useState<AuditScopeResult[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const currentWeek = getWeekString();

  const loadPastSessions = async () => {
    if (sessionsLoaded) return;
    try {
      const snap = await get(ref(db, `audit_sessions/${cityKey}/${studioKey}`));
      const data = snap.val() || {};
      setPastSessions(Object.values(data));
    } catch { /* ignore */ }
    setSessionsLoaded(true);
  };

  const discrepancyMap = useMemo(() => {
    const map = new Map<string, number>();
    pastSessions.forEach((s: any) => {
      const key = `${s.category}|${s.size}`;
      const disc = (s.missingBarcodes?.length || 0) + (s.unexpectedBarcodes?.length || 0);
      map.set(key, (map.get(key) || 0) + disc);
    });
    return map;
  }, [pastSessions]);

  const lastAuditedMap = useMemo(() => {
    const map = new Map<string, number>();
    pastSessions.forEach((s: any) => {
      const key = `${s.category}|${s.size}`;
      if (!s.completedAt) return;
      const days = Math.floor((Date.now() - new Date(s.completedAt).getTime()) / 86400000);
      if (!map.has(key) || days < map.get(key)!) map.set(key, days);
    });
    return map;
  }, [pastSessions]);

  const frequencyMap = useMemo(() => {
    const map = new Map<string, number>();
    Object.values(assignments)
      .filter(a => a.studio === studioName || (a as any).issuedAtStudio === studioKey)
      .forEach(a => {
        const key = `${a.itemName}|${a.itemSize}`;
        map.set(key, (map.get(key) || 0) + 1);
      });
    return map;
  }, [assignments, studioName, studioKey]);

  const buildRiskArray = (): AuditScope[] => {
    const seen = new Map<string, AuditScope>();
    Object.values(inventory)
      .filter(item => {
        const loc = (item.studioLocation || '').trim().toLowerCase();
        return loc === studioName.trim().toLowerCase() || loc === studioKey.trim().toLowerCase();
      })
      .forEach(item => {
        const key = `${getItemCategory(item)}|${item.size}`;
        if (seen.has(key)) return;
        const frequency = frequencyMap.get(key) || 0;
        const discrepancy = discrepancyMap.get(key) || 0;
        const lastAuditedDays = lastAuditedMap.get(key) ?? 999;
        const score = frequency * 2 + discrepancy * 4 + Math.min(lastAuditedDays, 60) * 1;
        seen.set(key, {
          key, name: getItemCategory(item), size: item.size,
          frequency, discrepancy, lastAuditedDays: lastAuditedDays === 999 ? -1 : lastAuditedDays,
          score, reasons: [], expectedBarcodes: [],
        });
      });

    seen.forEach((scope, key) => {
      const [name, size] = key.split('|');
      scope.expectedBarcodes = Object.values(inventory)
        .filter(item => {
          const loc = (item.studioLocation || '').trim().toLowerCase();
          const locMatch = loc === studioName.trim().toLowerCase() || loc === studioKey.trim().toLowerCase();
          return getItemCategory(item) === name && item.size === size && locMatch
            && (item.status === 'Available' || item.status === 'In Stock');
        })
        .map(i => i.barcode);
    });

    return Array.from(seen.values());
  };

  const generateWeeklyAudit = (): AuditScope[] => {
    const riskArray = buildRiskArray();
    if (riskArray.length === 0) return [];

    const highFreq = [...riskArray].sort((a, b) => b.frequency - a.frequency).slice(0, 2);
    const lowFreq  = [...riskArray].sort((a, b) => a.frequency - b.frequency).slice(0, 1);
    const highDisc = [...riskArray].sort((a, b) => b.discrepancy - a.discrepancy).slice(0, 2);

    const reasonMap = new Map<string, Set<string>>();
    highFreq.forEach(s => { if (!reasonMap.has(s.key)) reasonMap.set(s.key, new Set()); reasonMap.get(s.key)!.add('High Frequency'); });
    lowFreq.forEach(s  => { if (!reasonMap.has(s.key)) reasonMap.set(s.key, new Set()); reasonMap.get(s.key)!.add('Low Frequency'); });
    highDisc.forEach(s => { if (!reasonMap.has(s.key)) reasonMap.set(s.key, new Set()); reasonMap.get(s.key)!.add('Past Discrepancy'); });

    const combined = [...highFreq, ...lowFreq, ...highDisc];
    const unique = Array.from(new Map(combined.map(i => [i.key, i])).values());
    unique.forEach(s => { s.reasons = Array.from(reasonMap.get(s.key) || []); });
    unique.sort(() => 0.5 - Math.random());
    const count = 3 + Math.floor(Math.random() * 4);
    return unique.slice(0, Math.min(count, unique.length));
  };

  const handleGenerate = async () => {
    await loadPastSessions();
    setTimeout(() => {
      const generated = generateWeeklyAudit();
      if (generated.length === 0) {
        setMessage({ type: 'warning', text: 'No inventory found at this studio to audit.' });
        return;
      }
      setScopes(generated);
      setCompletedResults([]);
      setScopeIndex(0);
      setCurrentScanned([]);
      setBarcodeInput('');
      setMessage(null);
      setStage('scanning');
      setTimeout(() => scanInputRef.current?.focus(), 150);
    }, 120);
  };

  const currentScope = scopes[scopeIndex];

  const addBarcode = () => {
    const bc = barcodeInput.trim();
    if (!bc) return;
    if (currentScanned.includes(bc)) {
      setMessage({ type: 'warning', text: `${bc} already scanned.` });
      setBarcodeInput('');
      return;
    }
    const isExpected = currentScope?.expectedBarcodes.includes(bc);
    setCurrentScanned(prev => [...prev, bc]);
    setMessage({
      type: isExpected ? 'success' : 'warning',
      text: isExpected ? `✓ ${bc} — matched` : `⚠ ${bc} — not in expected list`,
    });
    setBarcodeInput('');
    scanInputRef.current?.focus();
  };

  const completeCurrentScope = () => {
    if (!currentScope) return;
    const expected = currentScope.expectedBarcodes;
    const found    = currentScanned.filter(bc => expected.includes(bc)).length;
    const missing  = expected.filter(bc => !currentScanned.includes(bc)).length;
    const unexpected = currentScanned.filter(bc => !expected.includes(bc)).length;
    const variancePct = expected.length > 0
      ? parseFloat(((missing + unexpected) / expected.length * 100).toFixed(1))
      : 0;
    const result: AuditScopeResult = {
      ...currentScope, scanned: [...currentScanned],
      found, missing, unexpected, variancePct,
    };
    setCompletedResults(prev => [...prev, result]);

    if (scopeIndex + 1 < scopes.length) {
      setScopeIndex(i => i + 1);
      setCurrentScanned([]);
      setBarcodeInput('');
      setMessage({ type: 'info', text: `Scope ${scopeIndex + 1} complete. Moving to next…` });
      setTimeout(() => scanInputRef.current?.focus(), 150);
    } else {
      setMessage(null);
      setStage('results');
    }
  };

  const saveAudit = async () => {
    setSaving(true);
    try {
      const ts = new Date().toISOString();
      const updates: Record<string, any> = {};
      const sessionKey = push(ref(db, `audit_sessions/${cityKey}/${studioKey}`)).key;
      updates[`audit_sessions/${cityKey}/${studioKey}/${sessionKey}`] = {
        week: currentWeek, studio: studioName, studioKey, city: cityName, cityKey,
        completedAt: ts,
        generatedScopes: completedResults.map(r => ({
          name: r.name, size: r.size, expectedBarcodes: r.expectedBarcodes,
        })),
        results: completedResults.map(r => ({
          category: r.name, size: r.size,
          expected: r.expectedBarcodes.length, found: r.found,
          missing: r.missing, unexpected: r.unexpected,
          variancePct: r.variancePct, score: r.score, reasons: r.reasons,
          scannedBarcodes: r.scanned,
          missingBarcodes: r.expectedBarcodes.filter(bc => !r.scanned.includes(bc)),
          unexpectedBarcodes: r.scanned.filter(bc => !r.expectedBarcodes.includes(bc)),
        })),
      };
      const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
      updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
        date: ts, action: 'CAO_AUDIT',
        details: `CAO Audit ${currentWeek} — ${studioName}: ${completedResults.length} scope(s). Missing: ${completedResults.reduce((s, r) => s + r.missing, 0)}, Unexpected: ${completedResults.reduce((s, r) => s + r.unexpected, 0)}.`,
      };
      await update(ref(db), updates);
      setMessage({ type: 'success', text: '✓ Audit saved.' });
    } catch { setMessage({ type: 'error', text: 'Failed to save audit.' }); }
    finally { setSaving(false); }
  };

  const exportCSV = () => {
    const headers = ['Studio', 'Week', 'Item Name', 'Size', 'Expected', 'Found', 'Missing', 'Unexpected', 'Variance %', 'Risk Score', 'Reason'];
    const rows = completedResults.map(r => [
      studioName, currentWeek, r.name, r.size,
      r.expectedBarcodes.length, r.found, r.missing, r.unexpected,
      r.variancePct, r.score, r.reasons.join(' + '),
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Weekly_Audit_${studioName}_${currentWeek.replace(/[^a-z0-9]/gi, '_')}.csv`;
    a.click();
  };

  const reset = () => {
    setStage('generate');
    setScopes([]);
    setScopeIndex(0);
    setCurrentScanned([]);
    setCompletedResults([]);
    setMessage(null);
    setBarcodeInput('');
  };

  return (
    <div className="analytics-section">
      <h3>⚡ Smart Audit — CAO System</h3>
      <p className="text-muted">
        Risk-scored weekly audit. System selects 3–6 scopes by issue frequency, past discrepancies, and days since last audit.
      </p>

      {message && <div className={`alert alert-${message.type}`} style={{ marginBottom: '1rem' }}>{message.text}</div>}

      {/* ── STAGE 1: GENERATE ── */}
      {stage === 'generate' && (
        <div className="cao-generate-panel">
          <div className="cao-how-it-works">
            <div className="cao-score-legend">
              <span className="cao-score-pill cao-score-freq">Issue Freq × 2</span>
              <span className="cao-score-plus">+</span>
              <span className="cao-score-pill cao-score-disc">Discrepancy × 4</span>
              <span className="cao-score-plus">+</span>
              <span className="cao-score-pill cao-score-days">Days Since Audit × 1</span>
              <span className="cao-score-eq">= Risk Score</span>
            </div>
            <p className="text-muted" style={{ margin: '0.5rem 0 0 0', fontSize: '0.82rem' }}>
              3–6 highest-risk item/size combos are selected. High frequency, past discrepancies, and long-unaudited items rank highest.
            </p>
          </div>

          <button className="btn btn-gold cao-generate-btn" onClick={handleGenerate}>
            ⚡ Generate This Week's Audit
          </button>
          <div className="cao-week-label">Current week: <strong>{currentWeek}</strong> &nbsp;·&nbsp; Studio: <strong>{studioName}</strong></div>
        </div>
      )}

      {/* ── STAGE 2: SCANNING ── */}
      {stage === 'scanning' && currentScope && (
        <div className="cao-scanning-panel">
          <div className="cao-progress-bar-wrap">
            {scopes.map((s, i) => (
              <div
                key={s.key}
                className={`cao-progress-segment ${i < scopeIndex ? 'done' : i === scopeIndex ? 'active' : ''}`}
                title={`${s.name} ${s.size}`}
              />
            ))}
          </div>
          <div className="cao-progress-label">Scope {scopeIndex + 1} of {scopes.length}</div>

          <div className="cao-scope-header">
            <div className="cao-scope-title">
              Now auditing: <strong>{currentScope.name}</strong> — <strong>{currentScope.size}</strong>
            </div>
            <div className="cao-scope-meta">
              <span className="cao-expected-badge">Expected: {currentScope.expectedBarcodes.length}</span>
              <span className="cao-scanned-badge">Scanned: {currentScanned.length}</span>
              {currentScope.reasons.map(r => (
                <span key={r} className={`cao-reason-tag cao-reason-${r.replace(/\s+/g, '-').toLowerCase()}`}>{r}</span>
              ))}
            </div>
          </div>

          {currentScope.expectedBarcodes.length > 0 && (
            <div className="cao-expected-list">
              {currentScope.expectedBarcodes.map(bc => (
                <span key={bc} className={`cao-barcode-chip ${currentScanned.includes(bc) ? 'found' : ''}`}>
                  {currentScanned.includes(bc) ? '✓ ' : ''}{bc}
                </span>
              ))}
            </div>
          )}

          <div className="cao-scan-row">
            <input
              ref={scanInputRef}
              type="text"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addBarcode(); }}
              placeholder="Scan or enter barcode…"
              className="input-dark cao-scan-input"
              autoFocus
            />
            <button onClick={addBarcode} className="btn btn-dark">Add</button>
          </div>

          {currentScanned.length > 0 && (
            <div className="cao-scanned-list">
              {[...currentScanned].reverse().slice(0, 8).map(bc => (
                <div key={bc} className="cao-scanned-row">
                  <code>{bc}</code>
                  <span className={currentScope.expectedBarcodes.includes(bc) ? 'cao-ok' : 'cao-warn'}>
                    {currentScope.expectedBarcodes.includes(bc) ? '✓ matched' : '⚠ unexpected'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="cao-scan-actions">
            <button onClick={completeCurrentScope} className="btn btn-gold">
              {scopeIndex + 1 < scopes.length ? 'Complete & Next →' : 'Complete Audit ✓'}
            </button>
            <button onClick={reset} className="btn btn-dark">Cancel</button>
          </div>
        </div>
      )}

      {/* ── STAGE 3: RESULTS ── */}
      {stage === 'results' && (
        <div className="cao-results-panel">
          <div className="cao-stat-cards">
            {[
              { label: 'Scopes Audited', val: completedResults.length,                                                        color: 'var(--color-accent)'  },
              { label: 'Total Missing',  val: completedResults.reduce((s, r) => s + r.missing, 0),                           color: 'var(--color-error)'   },
              { label: 'Unexpected',     val: completedResults.reduce((s, r) => s + r.unexpected, 0),                        color: 'var(--color-warning)' },
              { label: 'Clean Scopes',   val: completedResults.filter(r => r.missing === 0 && r.unexpected === 0).length,    color: 'var(--color-success)' },
            ].map(s => (
              <div key={s.label} className="cao-stat-card">
                <div className="cao-stat-val" style={{ color: s.color }}>{s.val}</div>
                <div className="cao-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="table-container" style={{ marginTop: '1rem' }}>
            <table className="table-dark">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Size</th>
                  <th>Expected</th>
                  <th>Found</th>
                  <th>Missing</th>
                  <th>Unexpected</th>
                  <th>Variance %</th>
                  <th>Risk Score</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {completedResults.map((r, i) => (
                  <tr key={i} className={r.missing > 0 || r.unexpected > 0 ? 'cao-row-alert' : ''}>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.size}</td>
                    <td>{r.expectedBarcodes.length}</td>
                    <td className="cao-td-found">{r.found}</td>
                    <td className={r.missing > 0 ? 'cao-td-missing' : ''}>{r.missing}</td>
                    <td className={r.unexpected > 0 ? 'cao-td-unexpected' : ''}>{r.unexpected}</td>
                    <td className={r.variancePct > 0 ? 'cao-td-variance' : ''}>{r.variancePct}%</td>
                    <td>{r.score}</td>
                    <td>
                      {r.reasons.map(reason => (
                        <span key={reason} className={`cao-reason-tag cao-reason-${reason.replace(/\s+/g, '-').toLowerCase()}`}>
                          {reason}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cao-results-actions">
            <button onClick={saveAudit} disabled={saving} className="btn btn-gold">
              {saving ? 'Saving…' : '💾 Save Audit'}
            </button>
            <button onClick={exportCSV} className="btn btn-dark">↓ Export CSV</button>
            <button onClick={reset} className="btn btn-secondary">New Audit</button>
          </div>
          <p className="text-muted" style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
            {currentWeek} · {studioName}
          </p>
        </div>
      )}
    </div>
  );
}
