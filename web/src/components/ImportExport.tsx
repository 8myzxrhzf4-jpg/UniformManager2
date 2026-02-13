import { useState, useRef } from 'react';
import { ref, update, push } from 'firebase/database';
import { db } from '../firebaseClient';
import type { CSVImportRow, CSVGPImportRow, CSVImportError, CSVSkippedRow, UniformItem, Assignment, LaundryOrder, LogEntry, GamePresenter } from '../types';
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
  gamePresenters?: Record<string, GamePresenter>;
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
  gamePresenters = {},
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
            studioName={studioName}
            inventory={inventory}
            gamePresenters={gamePresenters}
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
  studioName: string;
  inventory: Record<string, UniformItem>;
  gamePresenters: Record<string, GamePresenter>;
  onRefresh?: () => void;
}

function ImportCSV({ cityKey, studioKey, studioName, inventory, gamePresenters, onRefresh }: ImportCSVProps) {
  const [importType, setImportType] = useState<'inventory' | 'gp'>('inventory');
  const [preview, setPreview] = useState<(CSVImportRow | CSVGPImportRow)[]>([]);
  const [errors, setErrors] = useState<CSVImportError[]>([]);
  const [skippedRows, setSkippedRows] = useState<CSVSkippedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseInventoryCSV = (text: string): CSVImportRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: CSVImportRow[] = [];
    const parseErrors: CSVImportError[] = [];
    const skipped: CSVSkippedRow[] = [];
    
    // Required columns for inventory import (case-insensitive)
    const requiredHeaders = ['item', 'size', 'barcode'];
    const missingColumns = requiredHeaders.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      setMessage({ 
        type: 'error', 
        text: `Missing required columns: ${missingColumns.map(c => c.toUpperCase()).join(', ')}. Required: ITEM, SIZE, BARCODE` 
      });
      return [];
    }

    // Track barcodes seen in this file to detect in-file duplicates
    const seenBarcodes = new Set<string>();

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const lineNumber = i + 1;
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      const rowData = lines[i];

      // Validate required fields
      if (!row.barcode) {
        skipped.push({ rowNumber: lineNumber, data: rowData, reason: 'Empty barcode' });
        continue;
      }
      if (!row.item) {
        skipped.push({ rowNumber: lineNumber, data: rowData, reason: 'Empty item name' });
        continue;
      }
      if (!row.size) {
        skipped.push({ rowNumber: lineNumber, data: rowData, reason: 'Empty size' });
        continue;
      }

      // Check for duplicate barcode in file
      if (seenBarcodes.has(row.barcode)) {
        skipped.push({ rowNumber: lineNumber, data: rowData, reason: 'Duplicate barcode in file' });
        continue;
      }
      seenBarcodes.add(row.barcode);

      // Check for duplicate barcode in existing inventory
      const existingItem = Object.values(inventory).find(item => item.barcode === row.barcode);
      if (existingItem) {
        skipped.push({ 
          rowNumber: lineNumber, 
          data: rowData, 
          reason: `Barcode ${row.barcode} already exists in inventory` 
        });
        continue;
      }

      // Validate status value if provided
      const allowedStatuses = ['Available', 'In Stock', 'Issued', 'In Hamper', 'At Laundry', 'Damaged', 'Lost'];
      const statusValue = row.status ? row.status.trim() : '';
      if (statusValue && !allowedStatuses.some(s => s.toLowerCase() === statusValue.toLowerCase())) {
        skipped.push({
          rowNumber: lineNumber,
          data: rowData,
          reason: `Invalid status "${statusValue}". Must be one of: ${allowedStatuses.join(', ')}`
        });
        continue;
      }

      // Normalize status: default to "Available" if empty, map "In Stock" to "Available"
      let normalizedStatus = statusValue || 'Available';
      if (normalizedStatus.toLowerCase() === 'in stock') {
        normalizedStatus = 'Available';
      }

      rows.push({
        name: row.item,
        size: row.size,
        barcode: row.barcode,
        status: normalizedStatus,
        category: 'Other',
        studioLocation: row.studio || studioKey,
      });
    }

    setErrors(parseErrors);
    setSkippedRows(skipped);
    return rows;
  };

  const parseGPCSV = (text: string): CSVGPImportRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: CSVGPImportRow[] = [];
    const parseErrors: CSVImportError[] = [];
    const skipped: CSVSkippedRow[] = [];
    
    // Required columns for GP import (case-insensitive)
    const requiredHeaders = ['dealer', 'id card'];
    const missingColumns = requiredHeaders.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      setMessage({ 
        type: 'error', 
        text: `Missing required columns: ${missingColumns.map(c => c === 'id card' ? 'ID card' : c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}. Required: Dealer, ID card` 
      });
      return [];
    }

    // Track ID cards seen in this file to detect in-file duplicates
    const seenIdCards = new Set<string>();

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const lineNumber = i + 1;
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      const rowData = lines[i];

      // Validate required fields
      if (!row['id card']) {
        skipped.push({ rowNumber: lineNumber, data: rowData, reason: 'Empty ID card' });
        continue;
      }
      if (!row.dealer) {
        skipped.push({ rowNumber: lineNumber, data: rowData, reason: 'Empty dealer name' });
        continue;
      }

      // Check for duplicate ID card in file
      if (seenIdCards.has(row['id card'])) {
        skipped.push({ rowNumber: lineNumber, data: rowData, reason: 'Duplicate ID card in file' });
        continue;
      }
      seenIdCards.add(row['id card']);

      // Check for duplicate ID card in existing GPs
      const existingGP = Object.values(gamePresenters).find(gp => gp.barcode === row['id card']);
      if (existingGP) {
        skipped.push({ 
          rowNumber: lineNumber, 
          data: rowData, 
          reason: `ID card ${row['id card']} already exists` 
        });
        continue;
      }

      rows.push({
        gpName: row.dealer,
        gpIdCard: row['id card'],
      });
    }

    setErrors(parseErrors);
    setSkippedRows(skipped);
    return rows;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setMessage(null);
    setErrors([]);
    setSkippedRows([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = importType === 'inventory' 
        ? parseInventoryCSV(text) 
        : parseGPCSV(text);
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
      const updates: Record<string, object> = {};
      const timestamp = new Date().toISOString();
      
      if (importType === 'inventory') {
        // Batch write inventory items
        for (const row of preview as CSVImportRow[]) {
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
          details: `Imported ${preview.length} inventory items from CSV`,
        };
      } else {
        // Batch write GP items
        for (const row of preview as CSVGPImportRow[]) {
          const gpKey = push(ref(db, `gamePresenters/${cityKey}`)).key;
          updates[`gamePresenters/${cityKey}/${gpKey}`] = {
            name: row.gpName,
            barcode: row.gpIdCard,
            city: cityKey,
          };
        }

        // Log the import
        const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
        updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
          date: timestamp,
          action: 'IMPORT',
          details: `Imported ${preview.length} game presenters from CSV`,
        };
      }

      await update(ref(db), updates);

      const successMsg = `Successfully imported ${preview.length} ${importType === 'inventory' ? 'items' : 'game presenters'}`;
      const skippedMsg = skippedRows.length > 0 ? `. ${skippedRows.length} rows skipped (see downloadable log)` : '';
      setMessage({ type: 'success', text: successMsg + skippedMsg });
      
      setPreview([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      if (onRefresh) {
        setTimeout(onRefresh, 500);
      }
    } catch (error) {
      console.error('Import error:', error);
      setMessage({ type: 'error', text: 'Failed to import. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const downloadSkippedRowsCSV = () => {
    if (skippedRows.length === 0) return;

    let csv = 'Row Number,Data,Reason\n';
    skippedRows.forEach(row => {
      const escapedData = row.data.replace(/"/g, '""');
      csv += `${row.rowNumber},"${escapedData}","${row.reason}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const filename = importType === 'inventory' 
      ? 'inventory_import_skipped.csv' 
      : 'gp_import_skipped.csv';
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="import-content">
      <h3>Import from CSV</h3>
      
      <div className="form-group">
        <label>Import Type</label>
        <select
          value={importType}
          onChange={(e) => {
            setImportType(e.target.value as 'inventory' | 'gp');
            setPreview([]);
            setErrors([]);
            setSkippedRows([]);
            setMessage(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }}
          className="input-dark"
          disabled={loading}
        >
          <option value="inventory">Inventory</option>
          <option value="gp">Game Presenters (GPs)</option>
        </select>
      </div>

      <div className="help-text card" style={{ backgroundColor: '#1a1f2e', padding: '1rem', marginBottom: '1rem' }}>
        {importType === 'inventory' ? (
          <>
            <h4 style={{ marginTop: 0 }}>Inventory Import Requirements</h4>
            <p className="text-muted" style={{ marginBottom: '0.5rem' }}>
              <strong>Required columns (case-insensitive):</strong>
            </p>
            <ul className="text-muted" style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
              <li><strong>ITEM</strong> - uniform item name</li>
              <li><strong>SIZE</strong> - item size</li>
              <li><strong>BARCODE</strong> - unique identifier</li>
              <li><strong>STATUS</strong> - item status (optional, default: "Available")</li>
              <li style={{ marginLeft: '1.5rem', fontSize: '0.85rem' }}>Valid: Available, In Stock, Issued, In Hamper, At Laundry, Damaged, Lost</li>
              <li><strong>City</strong> - city name (optional)</li>
              <li><strong>Studio</strong> - studio location (optional, default: {studioName})</li>
            </ul>
            <p className="text-muted" style={{ marginBottom: 0, fontSize: '0.9rem' }}>
              Duplicates (by barcode) will be skipped.
            </p>
          </>
        ) : (
          <>
            <h4 style={{ marginTop: 0 }}>Game Presenter Import Requirements</h4>
            <p className="text-muted" style={{ marginBottom: '0.5rem' }}>
              <strong>Required columns (case-insensitive):</strong>
            </p>
            <ul className="text-muted" style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
              <li><strong>Dealer</strong> - presenter name</li>
              <li><strong>ID card</strong> - unique identifier</li>
            </ul>
            <p className="text-muted" style={{ marginBottom: 0, fontSize: '0.9rem' }}>
              Duplicates (by ID card) will be skipped.
            </p>
          </>
        )}
      </div>

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

      {skippedRows.length > 0 && (
        <div className="alert alert-warning">
          <strong>Skipped Rows: {skippedRows.length}</strong>
          <p>The following rows were skipped during parsing:</p>
          <ul className="error-list" style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {skippedRows.slice(0, 5).map((skip, index) => (
              <li key={index}>
                Row {skip.rowNumber}: {skip.reason}
              </li>
            ))}
            {skippedRows.length > 5 && (
              <li>... and {skippedRows.length - 5} more</li>
            )}
          </ul>
          <button
            onClick={downloadSkippedRowsCSV}
            className="btn btn-secondary"
            style={{ marginTop: '0.5rem' }}
          >
            Download Skipped Rows CSV
          </button>
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
            {importType === 'inventory' ? (
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
                  {(preview as CSVImportRow[]).slice(0, 10).map((row, index) => (
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
            ) : (
              <table className="table-dark">
                <thead>
                  <tr>
                    <th>Dealer Name</th>
                    <th>ID Card</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview as CSVGPImportRow[]).slice(0, 10).map((row, index) => (
                    <tr key={index}>
                      <td>{row.gpName}</td>
                      <td><code>{row.gpIdCard}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
          {loading ? 'Importing...' : `Import ${preview.length} ${importType === 'inventory' ? 'Items' : 'Game Presenters'}`}
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
