import { useState, useMemo } from 'react';
import { ref, update, push, get } from 'firebase/database';
import { db } from '../firebaseClient';
import type { Assignment, UniformItem, GPIssueSummary, ItemDemandSummary, ItemLifespanSummary, WeeklyAuditList, WeeklyAuditItem, AuditHistoryEntry } from '../types';
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
      
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'gp-report' ? 'active' : ''}`}
          onClick={() => setActiveTab('gp-report')}
        >
          GP Issues
        </button>
        <button
          className={`tab ${activeTab === 'demand' ? 'active' : ''}`}
          onClick={() => setActiveTab('demand')}
        >
          Demand by Size
        </button>
        <button
          className={`tab ${activeTab === 'lifespan' ? 'active' : ''}`}
          onClick={() => setActiveTab('lifespan')}
        >
          Item Lifespan
        </button>
        <button
          className={`tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Audit List
        </button>
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
          <AuditListGenerator
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

    // Group by category
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

        if (!categoryMap.has(item.category)) {
          categoryMap.set(item.category, []);
        }
        categoryMap.get(item.category)!.push(lifespanDays);
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
    let csv = 'Category,Avg Lifespan (Days),Median Lifespan (Days),Min,Max,Sample Size\n';
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
      <h3>Average Item Lifespan by Category</h3>
      <p className="text-muted">Time from first issue to damaged/lost status</p>

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
                <th>Category</th>
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

// Audit List Generator Component
function AuditListGenerator({ cityKey, cityName, studioKey, studioName, inventory, assignments }: AnalyticsComponentProps & { inventory: Record<string, UniformItem>; cityName: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [auditLists, setAuditLists] = useState<Record<string, WeeklyAuditList>>({});
  const [auditHistory, setAuditHistory] = useState<Record<string, AuditHistoryEntry>>({});

  // Load existing audit lists and history
  useMemo(() => {
    const loadData = async () => {
      try {
        const listsSnapshot = await get(ref(db, `audit_lists/${cityKey}/${studioKey}`));
        const historySnapshot = await get(ref(db, `audit_history/${cityKey}/${studioKey}`));
        
        setAuditLists(listsSnapshot.val() || {});
        setAuditHistory(historySnapshot.val() || {});
      } catch (error) {
        console.error('Error loading audit data:', error);
      }
    };
    loadData();
  }, [cityKey, studioKey]);

  const currentWeekId = useMemo(() => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((((now.getTime() - yearStart.getTime()) / 86400000) + yearStart.getDay() + 1) / 7);
    return `${now.getFullYear()}-${String(weekNumber).padStart(2, '0')}`;
  }, []);

  const canGenerate = useMemo(() => {
    // Check if we already generated for this week
    return !Object.values(auditLists).some((list) => list.weekId === currentWeekId);
  }, [auditLists, currentWeekId]);

  const generateAuditList = async () => {
    if (!canGenerate) {
      setMessage({ type: 'error', text: 'Audit list already generated for this week' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Get items in stock at this studio
      const studioItems = Object.entries(inventory)
        .filter(([, item]) => item.studioLocation === studioKey && item.status === 'In Stock')
        .map(([key, item]) => ({ key, ...item }));

      if (studioItems.length === 0) {
        setMessage({ type: 'error', text: 'No items in stock to audit' });
        setLoading(false);
        return;
      }

      // Calculate issue frequencies from assignments
      const itemFrequency = new Map<string, number>();
      Object.values(assignments).forEach((assignment) => {
        const key = `${assignment.itemName}|${assignment.itemSize}`;
        itemFrequency.set(key, (itemFrequency.get(key) || 0) + 1);
      });

      // Get items with mismatches from history
      const mismatchItems = new Set<string>();
      Object.values(auditHistory).forEach((entry) => {
        if (entry.delta !== 0) {
          mismatchItems.add(entry.itemBarcode);
        }
      });

      // Score items for audit priority
      const scoredItems = studioItems.map((item) => {
        const freqKey = `${item.name}|${item.size}`;
        const frequency = itemFrequency.get(freqKey) || 0;
        const hasMismatch = mismatchItems.has(item.barcode);
        
        // Score: high frequency + past mismatches get higher priority
        let score = frequency;
        if (hasMismatch) score += 100;
        
        // Add randomness for variety
        score += Math.random() * 10;

        return { item, score };
      });

      // Sort by score and select top items
      scoredItems.sort((a, b) => b.score - a.score);

      // Select 3-6 items, mix of high and low frequency
      const itemCount = Math.min(6, Math.max(3, studioItems.length));
      const selected: typeof scoredItems = [];

      // Get top items (frequent/mismatched)
      const topCount = Math.ceil(itemCount * 0.6);
      selected.push(...scoredItems.slice(0, topCount));

      // Get some random items for coverage
      const remaining = scoredItems.slice(topCount);
      const randomCount = itemCount - topCount;
      for (let i = 0; i < randomCount && remaining.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * remaining.length);
        selected.push(remaining.splice(randomIndex, 1)[0]);
      }

      // Create audit list items
      const auditItems: WeeklyAuditItem[] = selected.map(({ item }) => ({
        barcode: item.barcode,
        name: item.name,
        size: item.size,
        category: item.category,
        rationale: mismatchItems.has(item.barcode) 
          ? 'Previously had count mismatch'
          : itemFrequency.get(`${item.name}|${item.size}`) || 0 > 5
          ? 'High issue frequency'
          : 'Random selection for coverage',
        expectedLocation: studioName,
      }));

      // Create audit list
      const auditList: WeeklyAuditList = {
        weekId: currentWeekId,
        generatedAt: new Date().toISOString(),
        items: auditItems,
        city: cityName,
        studio: studioName,
      };

      // Save to database
      const updates: Record<string, WeeklyAuditList | { date: string; action: string; details: string }> = {};
      const listKey = push(ref(db, `audit_lists/${cityKey}/${studioKey}`)).key;
      updates[`audit_lists/${cityKey}/${studioKey}/${listKey}`] = auditList;

      // Log the action
      const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
      updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
        date: new Date().toISOString(),
        action: 'AUDIT_LIST_GENERATED',
        details: `Generated weekly audit list (${currentWeekId}) with ${auditItems.length} items`,
      };

      await update(ref(db), updates);

      setMessage({ type: 'success', text: `Generated audit list for week ${currentWeekId} with ${auditItems.length} items` });
      
      // Reload audit lists
      const listsSnapshot = await get(ref(db, `audit_lists/${cityKey}/${studioKey}`));
      setAuditLists(listsSnapshot.val() || {});
    } catch (error) {
      console.error('Generate audit list error:', error);
      setMessage({ type: 'error', text: 'Failed to generate audit list. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const exportCurrentList = () => {
    const currentList = Object.values(auditLists).find((list) => list.weekId === currentWeekId);
    if (!currentList) {
      setMessage({ type: 'error', text: 'No audit list for current week' });
      return;
    }

    let csv = 'Barcode,Name,Size,Category,Rationale,Expected Location\n';
    currentList.items.forEach((item) => {
      csv += `${item.barcode},${item.name},${item.size},${item.category},${item.rationale},${item.expectedLocation}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_list_${currentWeekId}_${studioName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentList = useMemo(() => {
    return Object.values(auditLists).find((list) => list.weekId === currentWeekId);
  }, [auditLists, currentWeekId]);

  return (
    <div className="analytics-section">
      <h3>Smart Weekly Audit List</h3>
      <p className="text-muted">Generate a smart audit list based on usage patterns and history</p>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="analytics-controls">
        <div className="audit-info-box">
          <strong>Current Week:</strong> {currentWeekId}
        </div>
        
        <button
          onClick={generateAuditList}
          disabled={loading || !canGenerate}
          className="btn btn-gold"
        >
          {loading ? 'Generating...' : canGenerate ? 'Generate Audit List' : 'Already Generated This Week'}
        </button>

        {currentList && (
          <button onClick={exportCurrentList} className="btn btn-outline">
            Export Current List
          </button>
        )}
      </div>

      {currentList ? (
        <>
          <h4>Week {currentList.weekId} Audit List</h4>
          <p className="text-muted">Generated: {new Date(currentList.generatedAt).toLocaleString()}</p>
          
          <div className="table-container">
            <table className="table-dark">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Name</th>
                  <th>Size</th>
                  <th>Category</th>
                  <th>Rationale</th>
                </tr>
              </thead>
              <tbody>
                {currentList.items.map((item, index) => (
                  <tr key={index}>
                    <td><code>{item.barcode}</code></td>
                    <td>{item.name}</td>
                    <td>{item.size}</td>
                    <td>{item.category}</td>
                    <td className="text-muted">{item.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-muted">No audit list generated for the current week yet</p>
      )}

      <div className="analytics-info">
        <h4>How It Works</h4>
        <ul className="text-muted">
          <li>Selects 3-6 items per week for audit</li>
          <li>Prioritizes items with past count mismatches</li>
          <li>Includes high-frequency items (issued often)</li>
          <li>Adds random items for comprehensive coverage over time</li>
          <li>Can only generate once per week</li>
        </ul>
      </div>
    </div>
  );
}
