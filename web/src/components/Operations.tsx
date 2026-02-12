import { useState } from 'react';
import { ref, update, push, get } from 'firebase/database';
import { db } from '../firebaseClient';
import type { UniformItem, GamePresenter } from '../types';
import './Operations.css';

interface OperationsProps {
  cityKey: string;
  cityName: string;
  studioKey: string;
  studioName: string;
  inventory: Record<string, UniformItem>;
  gps: Record<string, GamePresenter>;
  onRefresh?: () => void;
}

export function Operations({ cityKey, cityName, studioKey, studioName, inventory, gps, onRefresh }: OperationsProps) {
  const [activeTab, setActiveTab] = useState<'issue' | 'return' | 'laundry' | 'damage'>('issue');

  return (
    <div className="operations-container card">
      <h2 className="text-accent">Operations</h2>
      
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'issue' ? 'active' : ''}`}
          onClick={() => setActiveTab('issue')}
        >
          Issue
        </button>
        <button
          className={`tab ${activeTab === 'return' ? 'active' : ''}`}
          onClick={() => setActiveTab('return')}
        >
          Return
        </button>
        <button
          className={`tab ${activeTab === 'laundry' ? 'active' : ''}`}
          onClick={() => setActiveTab('laundry')}
        >
          Laundry
        </button>
        <button
          className={`tab ${activeTab === 'damage' ? 'active' : ''}`}
          onClick={() => setActiveTab('damage')}
        >
          Damage/Lost
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'issue' && (
          <IssueOperation
            cityKey={cityKey}
            cityName={cityName}
            studioKey={studioKey}
            studioName={studioName}
            inventory={inventory}
            gps={gps}
            onRefresh={onRefresh}
          />
        )}
        {activeTab === 'return' && (
          <ReturnOperation
            cityKey={cityKey}
            cityName={cityName}
            studioKey={studioKey}
            studioName={studioName}
            inventory={inventory}
            onRefresh={onRefresh}
          />
        )}
        {activeTab === 'laundry' && (
          <LaundryOperation
            cityKey={cityKey}
            cityName={cityName}
            studioKey={studioKey}
            studioName={studioName}
            inventory={inventory}
            onRefresh={onRefresh}
          />
        )}
        {activeTab === 'damage' && (
          <DamageOperation
            cityKey={cityKey}
            cityName={cityName}
            studioKey={studioKey}
            studioName={studioName}
            inventory={inventory}
            onRefresh={onRefresh}
          />
        )}
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
  onRefresh?: () => void;
}

function IssueOperation({ cityKey, cityName, studioKey, studioName, inventory, gps, onRefresh }: OperationComponentProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedGP, setSelectedGP] = useState('');
  const [newGPName, setNewGPName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter items that are In Stock and in the selected studio
  const availableItems = Object.entries(inventory).filter(
    ([_, item]) => item.status === 'In Stock' && item.studioLocation === studioKey
  );

  const gpList = gps ? Object.entries(gps).map(([key, gp]) => ({ key, ...gp })) : [];

  const handleIssue = async () => {
    if (selectedItems.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one item to issue' });
      return;
    }

    const gpName = selectedGP === 'new' ? newGPName.trim() : 
                   gpList.find(gp => gp.key === selectedGP)?.name || '';

    if (!gpName) {
      setMessage({ type: 'error', text: 'Please select or enter a GP name' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();

      // Update each selected item's status to Issued
      for (const itemKey of selectedItems) {
        const item = inventory[itemKey];
        updates[`inventory/${cityKey}/${itemKey}/status`] = 'Issued';

        // Create assignment record
        const assignmentKey = push(ref(db, `assignments/${cityKey}`)).key;
        updates[`assignments/${cityKey}/${assignmentKey}`] = {
          itemBarcode: item.barcode,
          itemName: item.name,
          itemSize: item.size,
          gpName,
          issuedAt: timestamp,
          status: 'active',
          city: cityName,
          studio: studioName,
        };
      }

      // Add GP if new
      if (selectedGP === 'new' && newGPName.trim()) {
        const gpKey = push(ref(db, 'gps')).key;
        updates[`gps/${gpKey}`] = {
          name: newGPName.trim(),
          city: cityName,
          studio: studioName,
        };
      }

      // Log the action
      const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
      updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
        date: timestamp,
        action: 'ISSUE',
        details: `Issued ${selectedItems.length} item(s) to ${gpName}: ${selectedItems.map(k => inventory[k].name).join(', ')}`,
      };

      await update(ref(db), updates);

      setMessage({ type: 'success', text: `Successfully issued ${selectedItems.length} item(s) to ${gpName}` });
      setSelectedItems([]);
      setSelectedGP('');
      setNewGPName('');
      
      if (onRefresh) {
        setTimeout(onRefresh, 500);
      }
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

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="form-group">
        <label>Select Game Presenter</label>
        <select
          value={selectedGP}
          onChange={(e) => setSelectedGP(e.target.value)}
          className="input-dark"
          disabled={loading}
        >
          <option value="">-- Select GP --</option>
          {gpList.map((gp) => (
            <option key={gp.key} value={gp.key}>
              {gp.name}
            </option>
          ))}
          <option value="new">+ Add New GP</option>
        </select>
      </div>

      {selectedGP === 'new' && (
        <div className="form-group">
          <label>New GP Name</label>
          <input
            type="text"
            value={newGPName}
            onChange={(e) => setNewGPName(e.target.value)}
            placeholder="Enter GP name"
            className="input-dark"
            disabled={loading}
          />
        </div>
      )}

      <div className="form-group">
        <label>Select Items (In Stock at {studioName})</label>
        {availableItems.length === 0 ? (
          <p className="text-muted">No items available to issue at this studio</p>
        ) : (
          <div className="item-list">
            {availableItems.map(([key, item]) => (
              <label key={key} className="item-checkbox">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedItems([...selectedItems, key]);
                    } else {
                      setSelectedItems(selectedItems.filter(k => k !== key));
                    }
                  }}
                  disabled={loading}
                />
                <span>
                  {item.name} - {item.size} ({item.barcode})
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleIssue}
        disabled={loading || selectedItems.length === 0 || (!selectedGP && !newGPName)}
        className="btn btn-gold"
      >
        {loading ? 'Issuing...' : `Issue ${selectedItems.length} Item(s)`}
      </button>
    </div>
  );
}

function ReturnOperation({ cityKey, studioKey, inventory, onRefresh }: OperationComponentProps) {
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const handleReturn = async () => {
    if (!barcode.trim()) {
      setMessage({ type: 'error', text: 'Please enter a barcode' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Find the item by barcode
      const itemEntry = Object.entries(inventory).find(([_, item]) => item.barcode === barcode.trim());
      
      if (!itemEntry) {
        setMessage({ type: 'error', text: `Item with barcode ${barcode} not found` });
        setLoading(false);
        return;
      }

      const [itemKey, item] = itemEntry;

      // Warn if not Issued or In Laundry
      if (item.status !== 'Issued' && item.status !== 'In Laundry') {
        setMessage({ type: 'warning', text: `Warning: Item status is "${item.status}", not "Issued" or "In Laundry"` });
      }

      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();

      // Update item status to In Stock
      updates[`inventory/${cityKey}/${itemKey}/status`] = 'In Stock';

      // Find and close active assignment
      const assignmentsSnapshot = await get(ref(db, `assignments/${cityKey}`));
      const assignments = assignmentsSnapshot.val() || {};
      
      for (const [assignmentKey, assignment] of Object.entries(assignments) as [string, any][]) {
        if (assignment.itemBarcode === item.barcode && assignment.status === 'active') {
          updates[`assignments/${cityKey}/${assignmentKey}/returnedAt`] = timestamp;
          updates[`assignments/${cityKey}/${assignmentKey}/status`] = 'returned';
        }
      }

      // Log the action
      const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
      updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
        date: timestamp,
        action: 'RETURN',
        details: `Returned ${item.name} (${item.barcode}) - previous status: ${item.status}`,
      };

      await update(ref(db), updates);

      setMessage({ type: 'success', text: `Successfully returned ${item.name} (${item.barcode})` });
      setBarcode('');
      
      if (onRefresh) {
        setTimeout(onRefresh, 500);
      }
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

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="form-group">
        <label>Barcode</label>
        <input
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleReturn();
            }
          }}
          placeholder="Scan or enter barcode"
          className="input-dark"
          disabled={loading}
          autoFocus
        />
      </div>

      <button
        onClick={handleReturn}
        disabled={loading || !barcode.trim()}
        className="btn btn-gold"
      >
        {loading ? 'Processing...' : 'Return Item'}
      </button>
    </div>
  );
}

function LaundryOperation({ cityKey, cityName, studioKey, studioName, inventory, onRefresh }: OperationComponentProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter items that are Issued (going to laundry) and in the selected studio
  const availableItems = Object.entries(inventory).filter(
    ([_, item]) => item.status === 'Issued' && item.studioLocation === studioKey
  );

  const handleCreateLaundryOrder = async () => {
    if (selectedItems.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one item for laundry' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      const orderNumber = `LO-${Date.now()}`;

      // Create laundry order
      const orderKey = push(ref(db, `laundry_orders/${cityKey}`)).key;
      updates[`laundry_orders/${cityKey}/${orderKey}`] = {
        orderNumber,
        items: selectedItems.map(k => inventory[k].barcode),
        createdAt: timestamp,
        status: 'pending',
        city: cityName,
        studio: studioName,
        itemCount: selectedItems.length,
      };

      // Update each selected item's status to In Laundry
      for (const itemKey of selectedItems) {
        updates[`inventory/${cityKey}/${itemKey}/status`] = 'In Laundry';
      }

      // Increment hamper count
      const hamperCountRef = ref(db, `cities/${cityKey}/studios/${studioKey}/currentHamperCount`);
      const hamperSnapshot = await get(hamperCountRef);
      const currentCount = hamperSnapshot.val() || 0;
      updates[`cities/${cityKey}/studios/${studioKey}/currentHamperCount`] = currentCount + selectedItems.length;

      // Log the action
      const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
      updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
        date: timestamp,
        action: 'LAUNDRY',
        details: `Created laundry order ${orderNumber} with ${selectedItems.length} item(s): ${selectedItems.map(k => inventory[k].name).join(', ')}`,
      };

      await update(ref(db), updates);

      setMessage({ type: 'success', text: `Laundry order ${orderNumber} created with ${selectedItems.length} item(s)` });
      setSelectedItems([]);
      
      if (onRefresh) {
        setTimeout(onRefresh, 500);
      }
    } catch (error) {
      console.error('Laundry order error:', error);
      setMessage({ type: 'error', text: 'Failed to create laundry order. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="operation-content">
      <h3>Create Laundry Order</h3>
      <p className="text-muted">Select issued items to send to laundry</p>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="form-group">
        <label>Select Items (Issued at {studioName})</label>
        {availableItems.length === 0 ? (
          <p className="text-muted">No issued items available for laundry at this studio</p>
        ) : (
          <div className="item-list">
            {availableItems.map(([key, item]) => (
              <label key={key} className="item-checkbox">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedItems([...selectedItems, key]);
                    } else {
                      setSelectedItems(selectedItems.filter(k => k !== key));
                    }
                  }}
                  disabled={loading}
                />
                <span>
                  {item.name} - {item.size} ({item.barcode})
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleCreateLaundryOrder}
        disabled={loading || selectedItems.length === 0}
        className="btn btn-gold"
      >
        {loading ? 'Creating...' : `Create Laundry Order (${selectedItems.length} items)`}
      </button>
    </div>
  );
}

function DamageOperation({ cityKey, cityName, studioKey, studioName, inventory, onRefresh }: OperationComponentProps) {
  const [barcode, setBarcode] = useState('');
  const [damageType, setDamageType] = useState<'damaged' | 'lost'>('damaged');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleMarkDamaged = async () => {
    if (!barcode.trim()) {
      setMessage({ type: 'error', text: 'Please enter a barcode' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Find the item by barcode
      const itemEntry = Object.entries(inventory).find(([_, item]) => item.barcode === barcode.trim());
      
      if (!itemEntry) {
        setMessage({ type: 'error', text: `Item with barcode ${barcode} not found` });
        setLoading(false);
        return;
      }

      const [itemKey, item] = itemEntry;
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      const newStatus = damageType === 'damaged' ? 'Damaged' : 'Lost';

      // Update item status
      updates[`inventory/${cityKey}/${itemKey}/status`] = newStatus;

      // Create damage record
      const damageKey = push(ref(db, `damages/${cityKey}`)).key;
      updates[`damages/${cityKey}/${damageKey}`] = {
        itemBarcode: item.barcode,
        itemName: item.name,
        damageType,
        reportedAt: timestamp,
        notes: notes.trim(),
        city: cityName,
        studio: studioName,
      };

      // Log the action
      const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
      updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
        date: timestamp,
        action: damageType.toUpperCase(),
        details: `Marked ${item.name} (${item.barcode}) as ${newStatus}${notes ? ': ' + notes : ''}`,
      };

      await update(ref(db), updates);

      setMessage({ type: 'success', text: `Successfully marked ${item.name} as ${newStatus}` });
      setBarcode('');
      setNotes('');
      
      if (onRefresh) {
        setTimeout(onRefresh, 500);
      }
    } catch (error) {
      console.error('Damage/Lost error:', error);
      setMessage({ type: 'error', text: 'Failed to mark item. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="operation-content">
      <h3>Mark Item as Damaged/Lost</h3>
      <p className="text-muted">Scan or enter barcode to mark item</p>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="form-group">
        <label>Damage Type</label>
        <select
          value={damageType}
          onChange={(e) => setDamageType(e.target.value as 'damaged' | 'lost')}
          className="input-dark"
          disabled={loading}
        >
          <option value="damaged">Damaged</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      <div className="form-group">
        <label>Barcode</label>
        <input
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder="Scan or enter barcode"
          className="input-dark"
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label>Notes (Optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional details about the damage or loss"
          className="input-dark"
          rows={3}
          disabled={loading}
        />
      </div>

      <button
        onClick={handleMarkDamaged}
        disabled={loading || !barcode.trim()}
        className="btn btn-danger"
      >
        {loading ? 'Processing...' : `Mark as ${damageType === 'damaged' ? 'Damaged' : 'Lost'}`}
      </button>
    </div>
  );
}
