import { useState, useRef } from 'react';
import { ref, update, push } from 'firebase/database';
import { db } from '../firebaseClient';
import type { CSVImportRow, CSVImportError, UniformItem, Assignment, LaundryOrder, LogEntry } from '../types';
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
  onRefresh?: () => void;
}

export function ImportExport({ 
  cityKey, 
  cityName, 
  studioKey, 
  studioName, 
  inventory, 
  assignments, 
  laundryOrders, 
  logs,
  onRefresh 
}: ImportExportProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');

  return (
    <div className="import-export-container card">
      <h2 className="text-accent">Import/Export</h2>
      
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          Import CSV
        </button>
        <button
          className={`tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          Export CSV
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'import' && (
          <ImportCSV
            cityKey={cityKey}
            studioKey={studioKey}
            inventory={inventory}
            onRefresh={onRefresh}
          />
        )}
        {activeTab === 'export' && (
          <ExportCSV
            cityName={cityName}
            studioName={studioName}
            inventory={inventory}
            assignments={assignments}
            laundryOrders={laundryOrders}
            logs={logs}
          />
        )}
      </div>
    </div>
  );
}

interface ImportCSVProps {
  cityKey: string;
  studioKey: string;
  inventory: Record<string, UniformItem>;
  onRefresh?: () => void;
}

function ImportCSV({ cityKey, studioKey, inventory, onRefresh }: ImportCSVProps) {
  const [preview, setPreview] = useState<CSVImportRow[]>([]);
  const [errors, setErrors] = useState<CSVImportError[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requiredColumns = ['name', 'size', 'barcode', 'status', 'category', 'studioLocation'];

  const parseCSV = (text: string): CSVImportRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: CSVImportRow[] = [];
    const parseErrors: CSVImportError[] = [];

    // Validate headers
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
      setMessage({ 
        type: 'error', 
        text: `Missing required columns: ${missingColumns.join(', ')}` 
      });
      return [];
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      // Validate required fields
      const rowErrors: string[] = [];
      if (!row.name) rowErrors.push('name is required');
      if (!row.barcode) rowErrors.push('barcode is required');
      if (!row.size) rowErrors.push('size is required');
      
      if (rowErrors.length > 0) {
        rowErrors.forEach(error => {
          parseErrors.push({ row: i + 1, field: 'validation', message: error });
        });
        continue;
      }

      // Check for duplicate barcode in existing inventory
      const existingItem = Object.values(inventory).find(item => item.barcode === row.barcode);
      if (existingItem) {
        parseErrors.push({ 
          row: i + 1, 
          field: 'barcode', 
          message: `Barcode ${row.barcode} already exists` 
        });
        continue;
      }

      rows.push({
        name: row.name,
        size: row.size,
        barcode: row.barcode,
        status: row.status || 'In Stock',
        category: row.category || 'Other',
        studioLocation: row.studiolocation || studioKey,
      });
    }

    setErrors(parseErrors);
    return rows;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setMessage(null);
    setErrors([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setPreview(parsed);
      
      if (parsed.length > 0) {
        setMessage({ type: 'info', text: `Parsed ${parsed.length} row(s) successfully` });
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (preview.length === 0) {
      setMessage({ type: 'error', text: 'No data to import' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      
      // Batch write items (use update() to avoid throttling)
      for (const row of preview) {
        const itemKey = push(ref(db, `inventory/${cityKey}`)).key;
        updates[`inventory/${cityKey}/${itemKey}`] = {
          name: row.name,
          size: row.size,
          barcode: row.barcode,
          status: row.status,
          category: row.category,
          studioLocation: row.studioLocation,
        };
      }

      // Log the import
      const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
      updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
        date: timestamp,
        action: 'IMPORT',
        details: `Imported ${preview.length} items from CSV`,
      };

      await update(ref(db), updates);

      setMessage({ type: 'success', text: `Successfully imported ${preview.length} items` });
      setPreview([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      if (onRefresh) {
        setTimeout(onRefresh, 500);
      }
    } catch (error) {
      console.error('Import error:', error);
      setMessage({ type: 'error', text: 'Failed to import items. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="import-content">
      <h3>Import Inventory from CSV</h3>
      <p className="text-muted">
        CSV must include columns: {requiredColumns.join(', ')}
      </p>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {errors.length > 0 && (
        <div className="alert alert-error">
          <strong>Validation Errors:</strong>
          <ul className="error-list">
            {errors.map((error, index) => (
              <li key={index}>
                Row {error.row}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-group">
        <label>Select CSV File</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="file-input"
          disabled={loading}
        />
      </div>

      {preview.length > 0 && (
        <div className="preview-section">
          <h4>Preview ({preview.length} items)</h4>
          <div className="table-container">
            <table className="table-dark">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Size</th>
                  <th>Barcode</th>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Studio</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((row, index) => (
                  <tr key={index}>
                    <td>{row.name}</td>
                    <td>{row.size}</td>
                    <td><code>{row.barcode}</code></td>
                    <td>{row.status}</td>
                    <td>{row.category}</td>
                    <td>{row.studioLocation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 10 && (
              <p className="text-muted">Showing first 10 of {preview.length} rows</p>
            )}
          </div>
        </div>
      )}

      <div className="button-group">
        <button
          onClick={handleImport}
          disabled={loading || preview.length === 0 || errors.length > 0}
          className="btn btn-gold"
        >
          {loading ? 'Importing...' : `Import ${preview.length} Items`}
        </button>
      </div>
    </div>
  );
}

interface ExportCSVProps {
  cityName: string;
  studioName: string;
  inventory: Record<string, UniformItem>;
  assignments: Record<string, Assignment>;
  laundryOrders: Record<string, LaundryOrder>;
  logs: Record<string, LogEntry>;
}

function ExportCSV({ cityName, studioName, inventory, assignments, laundryOrders, logs }: ExportCSVProps) {
  const [exportType, setExportType] = useState<'inventory' | 'assignments' | 'laundry' | 'logs'>('inventory');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filterByDate = (dateStr: string): boolean => {
    if (!dateRange.start && !dateRange.end) return true;
    const itemDate = new Date(dateStr);
    const start = dateRange.start ? new Date(dateRange.start) : null;
    const end = dateRange.end ? new Date(dateRange.end) : null;
    
    if (start && itemDate < start) return false;
    if (end && itemDate > end) return false;
    return true;
  };

  const handleExport = () => {
    let csv = '';
    let filename = '';

    switch (exportType) {
      case 'inventory':
        csv = 'Name,Size,Barcode,Status,Category,Studio Location\n';
        Object.values(inventory).forEach(item => {
          csv += `${item.name},${item.size},${item.barcode},${item.status},${item.category},${item.studioLocation}\n`;
        });
        filename = `inventory_${cityName}_${studioName}_${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'assignments':
        csv = 'Item Name,Item Size,Item Barcode,GP Name,Issued At,Returned At,Status,City,Studio\n';
        Object.values(assignments)
          .filter(a => filterByDate(a.issuedAt))
          .forEach(assignment => {
            csv += `${assignment.itemName},${assignment.itemSize},${assignment.itemBarcode},${assignment.gpName},${assignment.issuedAt},${assignment.returnedAt || ''},${assignment.status},${assignment.city},${assignment.studio}\n`;
          });
        filename = `assignments_${cityName}_${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'laundry':
        csv = 'Order Number,Item Count,Created At,Picked Up At,Returned At,Status,City,Studio\n';
        Object.values(laundryOrders)
          .filter(order => filterByDate(order.createdAt))
          .forEach(order => {
            csv += `${order.orderNumber},${order.itemCount},${order.createdAt},${order.pickedUpAt || ''},${order.returnedAt || ''},${order.status},${order.city},${order.studio}\n`;
          });
        filename = `laundry_orders_${cityName}_${studioName}_${new Date().toISOString().split('T')[0]}.csv`;
        break;

      case 'logs':
        csv = 'Date,Action,Details\n';
        Object.values(logs)
          .filter(log => filterByDate(log.date))
          .forEach(log => {
            const details = log.details.replace(/,/g, ';'); // Replace commas to avoid CSV issues
            csv += `${log.date},${log.action},${details}\n`;
          });
        filename = `logs_${cityName}_${studioName}_${new Date().toISOString().split('T')[0]}.csv`;
        break;
    }

    downloadCSV(csv, filename);
  };

  return (
    <div className="export-content">
      <h3>Export to CSV</h3>
      <p className="text-muted">Export data for {cityName} - {studioName}</p>

      <div className="form-group">
        <label>Export Type</label>
        <select
          value={exportType}
          onChange={(e) => setExportType(e.target.value as any)}
          className="input-dark"
        >
          <option value="inventory">Inventory</option>
          <option value="assignments">Assignments</option>
          <option value="laundry">Laundry Orders</option>
          <option value="logs">Logs</option>
        </select>
      </div>

      {exportType !== 'inventory' && (
        <div className="date-range-group">
          <div className="form-group">
            <label>Start Date (Optional)</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="input-dark"
            />
          </div>
          <div className="form-group">
            <label>End Date (Optional)</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="input-dark"
            />
          </div>
        </div>
      )}

      <button
        onClick={handleExport}
        className="btn btn-gold"
      >
        Export CSV
      </button>

      <div className="export-info">
        <h4>CSV Format Information</h4>
        <ul className="text-muted">
          <li><strong>Inventory:</strong> Name, Size, Barcode, Status, Category, Studio Location</li>
          <li><strong>Assignments:</strong> Item details, GP Name, Issued/Returned timestamps, Status</li>
          <li><strong>Laundry Orders:</strong> Order Number, Item Count, Timestamps, Status</li>
          <li><strong>Logs:</strong> Date, Action, Details (studio-scoped, time-bounded)</li>
        </ul>
      </div>
    </div>
  );
}
