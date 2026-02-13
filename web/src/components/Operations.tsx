import { useState } from 'react';
import { ref, update, push, get } from 'firebase/database';
import { db } from '../firebaseClient';
import type { UniformItem, GamePresenter, Studio } from '../types';
import './Operations.css';

// TODO: Replace with actual authenticated user when auth is implemented
const CURRENT_USER = 'web-user';

// Helper to create tracking field resets
const clearTrackingFields = (prefix: string) => ({
  [`${prefix}/issuedAt`]: null,
  [`${prefix}/issuedAtStudio`]: null,
  [`${prefix}/issuedAtCity`]: null,
  [`${prefix}/issuedBy`]: null,
  [`${prefix}/returnedAt`]: null,
  [`${prefix}/returnedAtStudio`]: null,
  [`${prefix}/returnedBy`]: null,
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
            studios={studios}
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
            studios={studios}
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
  studios?: Record<string, Studio>;
  onRefresh?: () => void;
}

function IssueOperation({ cityKey, cityName, studioKey, studioName, inventory, gps, studios = {}, onRefresh }: OperationComponentProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedGP, setSelectedGP] = useState('');
  const [newGPName, setNewGPName] = useState('');
  const [newGPIdCard, setNewGPIdCard] = useState('');
  const [targetStudioKey, setTargetStudioKey] = useState(studioKey);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Get studio list
  const studioList = Object.entries(studios).map(([key, studio]) => ({ key, name: studio.name }));

  // Filter items that are Available/In Stock and in the selected studio
  const availableItems = Object.entries(inventory).filter(
    ([_, item]) => (item.status === 'Available' || item.status === 'In Stock') && item.studioLocation === targetStudioKey
  );

  const gpList = gps ? Object.entries(gps).map(([key, gp]) => ({ key, ...gp })) : [];

  const handleIssue = async () => {
    if (selectedItems.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one item to issue' });
      return;
    }

    const gpName = selectedGP === 'new' ? newGPName.trim() : 
                   gpList.find(gp => gp.key === selectedGP)?.name || '';
    const gpIdCard = selectedGP === 'new' ? newGPIdCard.trim() : 
                     gpList.find(gp => gp.key === selectedGP)?.barcode || '';

    if (!gpName) {
      setMessage({ type: 'error', text: 'Please select or enter a GP name' });
      return;
    }

    if (selectedGP === 'new' && !newGPIdCard.trim()) {
      setMessage({ type: 'error', text: 'Please enter GP ID card' });
      return;
    }

    // Check for duplicate barcodes in the batch
    const barcodes = selectedItems.map(key => inventory[key].barcode);
    const uniqueBarcodes = new Set(barcodes);
    if (barcodes.length !== uniqueBarcodes.size) {
      // Find duplicates
      const duplicates = barcodes.filter((barcode, index) => barcodes.indexOf(barcode) !== index);
      setMessage({ type: 'error', text: `Duplicate barcodes detected: ${[...new Set(duplicates)].join(', ')}` });
      return;
    }

    // Check that all items are Available or In Stock
    const nonAvailableItems = selectedItems.filter(key => {
      const item = inventory[key];
      return item.status !== 'Available' && item.status !== 'In Stock';
    });
    if (nonAvailableItems.length > 0) {
      const itemNames = nonAvailableItems.map(key => inventory[key].name).join(', ');
      setMessage({ type: 'error', text: `Cannot issue non-Available items: ${itemNames}` });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      const targetStudio = studioList.find(s => s.key === targetStudioKey);
      const targetStudioName = targetStudio?.name || studioName;

      // Update each selected item's status to Issued
      for (const itemKey of selectedItems) {
        const item = inventory[itemKey];
        updates[`inventory/${cityKey}/${itemKey}/status`] = 'Issued';
        updates[`inventory/${cityKey}/${itemKey}/issuedAt`] = timestamp;
        updates[`inventory/${cityKey}/${itemKey}/issuedAtStudio`] = targetStudioKey;
        updates[`inventory/${cityKey}/${itemKey}/issuedAtCity`] = cityKey;
        updates[`inventory/${cityKey}/${itemKey}/issuedBy`] = CURRENT_USER; // TODO: Use actual user

        // Create assignment record
        const assignmentKey = push(ref(db, `assignments/${cityKey}`)).key;
        updates[`assignments/${cityKey}/${assignmentKey}`] = {
          itemBarcode: item.barcode,
          itemName: item.name,
          itemSize: item.size,
          gpName,
          gpBarcode: gpIdCard,
          issuedAt: timestamp,
          issuedAtStudio: targetStudioKey,
          issuedAtCity: cityKey,
          issuedBy: CURRENT_USER, // TODO: Use actual user
          status: 'active',
          city: cityName,
          studio: targetStudioName,
        };
      }

      // Add GP if new
      if (selectedGP === 'new' && newGPName.trim()) {
        const gpKey = push(ref(db, `gamePresenters/${cityKey}`)).key;
        updates[`gamePresenters/${cityKey}/${gpKey}`] = {
          name: newGPName.trim(),
          barcode: newGPIdCard.trim(),
          city: cityName,
          studio: targetStudioName,
        };
      }

      // Log the action
      const logKey = push(ref(db, `logs/${cityKey}/${targetStudioKey}`)).key;
      updates[`logs/${cityKey}/${targetStudioKey}/${logKey}`] = {
        date: timestamp,
        action: 'ISSUE',
        details: `Issued ${selectedItems.length} item(s) to ${gpName} at ${targetStudioName}: ${selectedItems.map(k => inventory[k].name).join(', ')}`,
      };

      await update(ref(db), updates);

      setMessage({ type: 'success', text: `Successfully issued ${selectedItems.length} item(s) to ${gpName}` });
      setSelectedItems([]);
      setSelectedGP('');
      setNewGPName('');
      setNewGPIdCard('');
      
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
        <label>Target Studio</label>
        <select
          value={targetStudioKey}
          onChange={(e) => {
            setTargetStudioKey(e.target.value);
            setSelectedItems([]); // Clear selections when studio changes
          }}
          className="input-dark"
          disabled={loading}
        >
          {studioList.map((studio) => (
            <option key={studio.key} value={studio.key}>
              {studio.name}
            </option>
          ))}
        </select>
      </div>

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
              {gp.name} {gp.barcode ? `(${gp.barcode})` : ''}
            </option>
          ))}
          <option value="new">+ Add New GP</option>
        </select>
      </div>

      {selectedGP === 'new' && (
        <>
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
          <div className="form-group">
            <label>New GP ID Card</label>
            <input
              type="text"
              value={newGPIdCard}
              onChange={(e) => setNewGPIdCard(e.target.value)}
              placeholder="Enter GP ID card number"
              className="input-dark"
              disabled={loading}
            />
          </div>
        </>
      )}

      <div className="form-group">
        <label>Select Items (Available at {studioList.find(s => s.key === targetStudioKey)?.name || 'selected studio'})</label>
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
        disabled={loading || selectedItems.length === 0 || (!selectedGP)}
        className="btn btn-gold"
      >
        {loading ? 'Issuing...' : `Issue ${selectedItems.length} Item(s)`}
      </button>
    </div>
  );
}

function ReturnOperation({ cityKey, studioKey, studioName, inventory, studios = {}, onRefresh }: OperationComponentProps) {
  const [barcode, setBarcode] = useState('');
  const [targetStudioKey, setTargetStudioKey] = useState(studioKey);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Get studio list
  const studioList = Object.entries(studios).map(([key, studio]) => ({ key, name: studio.name }));

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

      // Only allow returning Issued items
      if (item.status !== 'Issued') {
        setMessage({ type: 'error', text: `Item status is "${item.status}". Only Issued items can be returned.` });
        setLoading(false);
        return;
      }

      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();
      const targetStudio = studioList.find(s => s.key === targetStudioKey);
      const targetStudioName = targetStudio?.name || studioName;

      // Update item status to In Hamper and track return info
      updates[`inventory/${cityKey}/${itemKey}/status`] = 'In Hamper';
      updates[`inventory/${cityKey}/${itemKey}/returnedAt`] = timestamp;
      updates[`inventory/${cityKey}/${itemKey}/returnedAtStudio`] = targetStudioKey;
      updates[`inventory/${cityKey}/${itemKey}/returnedBy`] = CURRENT_USER; // TODO: Use actual user
      updates[`inventory/${cityKey}/${itemKey}/studioLocation`] = targetStudioKey; // Update location to return studio

      // Increment hamper count for the target studio
      if (studios[targetStudioKey]) {
        const currentCount = studios[targetStudioKey].currentHamperCount || 0;
        updates[`cities/${cityKey}/studios/${targetStudioKey}/currentHamperCount`] = currentCount + 1;
      }

      // Find and close active assignment
      const assignmentsSnapshot = await get(ref(db, `assignments/${cityKey}`));
      const assignments = assignmentsSnapshot.val() || {};
      
      for (const [assignmentKey, assignment] of Object.entries(assignments) as [string, any][]) {
        if (assignment.itemBarcode === item.barcode && assignment.status === 'active') {
          updates[`assignments/${cityKey}/${assignmentKey}/returnedAt`] = timestamp;
          updates[`assignments/${cityKey}/${assignmentKey}/returnedAtStudio`] = targetStudioKey;
          updates[`assignments/${cityKey}/${assignmentKey}/returnedBy`] = CURRENT_USER; // TODO: Use actual user
          updates[`assignments/${cityKey}/${assignmentKey}/status`] = 'returned';
        }
      }

      // Log the action
      const logKey = push(ref(db, `logs/${cityKey}/${targetStudioKey}`)).key;
      updates[`logs/${cityKey}/${targetStudioKey}/${logKey}`] = {
        date: timestamp,
        action: 'RETURN',
        details: `Returned ${item.name} (${item.barcode}) to ${targetStudioName} hamper - issued from: ${item.issuedAtStudio || 'unknown'}`,
      };

      await update(ref(db), updates);

      setMessage({ type: 'success', text: `Successfully returned ${item.name} (${item.barcode}) to ${targetStudioName} hamper` });
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
      <p className="text-muted">Scan or enter barcode to return item to hamper</p>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="form-group">
        <label>Return to Studio</label>
        <select
          value={targetStudioKey}
          onChange={(e) => setTargetStudioKey(e.target.value)}
          className="input-dark"
          disabled={loading}
        >
          {studioList.map((studio) => (
            <option key={studio.key} value={studio.key}>
              {studio.name}
            </option>
          ))}
        </select>
        <small className="text-muted">Item will be placed in this studio's hamper</small>
      </div>

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
        {loading ? 'Processing...' : 'Return Item to Hamper'}
      </button>
    </div>
  );
}

function LaundryOperation({ cityKey, cityName, studioKey, studioName, inventory, onRefresh }: OperationComponentProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [operation, setOperation] = useState<'pickup' | 'receive'>('pickup');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filter items based on operation
  // For pickup: items In Hamper at selected studio
  // For receive: items At Laundry
  const availableItems = Object.entries(inventory).filter(([_, item]) => {
    if (operation === 'pickup') {
      return item.status === 'In Hamper' && item.studioLocation === studioKey;
    } else {
      return item.status === 'At Laundry';
    }
  });

  const handleLaundryPickup = async () => {
    if (selectedItems.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one item for laundry pickup' });
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
        pickedUpAt: timestamp,
        status: 'picked_up',
        city: cityName,
        studio: studioName,
        itemCount: selectedItems.length,
      };

      // Update each selected item's status to At Laundry
      for (const itemKey of selectedItems) {
        updates[`inventory/${cityKey}/${itemKey}/status`] = 'At Laundry';
      }

      // Decrement hamper count for picked up items
      const hamperCountRef = ref(db, `cities/${cityKey}/studios/${studioKey}/currentHamperCount`);
      const hamperSnapshot = await get(hamperCountRef);
      const currentCount = hamperSnapshot.val() || 0;
      const newCount = Math.max(0, currentCount - selectedItems.length);
      updates[`cities/${cityKey}/studios/${studioKey}/currentHamperCount`] = newCount;

      // Log the action
      const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
      updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
        date: timestamp,
        action: 'LAUNDRY_PICKUP',
        details: `Laundry pickup ${orderNumber}: ${selectedItems.length} item(s) sent to laundry from ${studioName}`,
      };

      await update(ref(db), updates);

      setMessage({ type: 'success', text: `Laundry pickup ${orderNumber} completed: ${selectedItems.length} item(s) sent to laundry` });
      setSelectedItems([]);
      
      if (onRefresh) {
        setTimeout(onRefresh, 500);
      }
    } catch (error) {
      console.error('Laundry pickup error:', error);
      setMessage({ type: 'error', text: 'Failed to process laundry pickup. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleLaundryReceive = async () => {
    if (selectedItems.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one item to receive from laundry' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();

      // Update each selected item's status to Available
      for (const itemKey of selectedItems) {
        updates[`inventory/${cityKey}/${itemKey}/status`] = 'Available';
        updates[`inventory/${cityKey}/${itemKey}/studioLocation`] = studioKey;
        // Clear issue/return tracking since item is now clean and available
        Object.assign(updates, clearTrackingFields(`inventory/${cityKey}/${itemKey}`));
      }

      // Update laundry order status if found
      const ordersSnapshot = await get(ref(db, `laundry_orders/${cityKey}`));
      const orders = ordersSnapshot.val() || {};
      
      for (const [orderKey, order] of Object.entries(orders) as [string, any][]) {
        if (order.status === 'picked_up') {
          const orderItemBarcodes = order.items || [];
          const selectedBarcodes = selectedItems.map(k => inventory[k].barcode);
          const hasMatchingItems = selectedBarcodes.some((bc: string) => orderItemBarcodes.includes(bc));
          
          if (hasMatchingItems) {
            updates[`laundry_orders/${cityKey}/${orderKey}/returnedAt`] = timestamp;
            updates[`laundry_orders/${cityKey}/${orderKey}/status`] = 'returned';
          }
        }
      }

      // Log the action
      const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
      updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
        date: timestamp,
        action: 'LAUNDRY_RECEIVE',
        details: `Received ${selectedItems.length} item(s) from laundry at ${studioName}, now Available`,
      };

      await update(ref(db), updates);

      setMessage({ type: 'success', text: `Successfully received ${selectedItems.length} item(s) from laundry. Items are now Available.` });
      setSelectedItems([]);
      
      if (onRefresh) {
        setTimeout(onRefresh, 500);
      }
    } catch (error) {
      console.error('Laundry receive error:', error);
      setMessage({ type: 'error', text: 'Failed to receive items from laundry. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="operation-content">
      <h3>Laundry Operations</h3>
      <p className="text-muted">Manage laundry pickup and return</p>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="form-group">
        <label>Operation</label>
        <select
          value={operation}
          onChange={(e) => {
            setOperation(e.target.value as 'pickup' | 'receive');
            setSelectedItems([]);
          }}
          className="input-dark"
          disabled={loading}
        >
          <option value="pickup">Pickup from Hamper (In Hamper → At Laundry)</option>
          <option value="receive">Receive from Laundry (At Laundry → Available)</option>
        </select>
      </div>

      <div className="form-group">
        <label>
          {operation === 'pickup' 
            ? `Select Items (In Hamper at ${studioName})` 
            : 'Select Items (At Laundry)'}
        </label>
        {availableItems.length === 0 ? (
          <p className="text-muted">
            {operation === 'pickup'
              ? 'No items in hamper at this studio'
              : 'No items currently at laundry'}
          </p>
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
                  {item.name} - {item.size} ({item.barcode}) - Studio: {item.studioLocation}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={operation === 'pickup' ? handleLaundryPickup : handleLaundryReceive}
        disabled={loading || selectedItems.length === 0}
        className="btn btn-gold"
      >
        {loading 
          ? 'Processing...' 
          : operation === 'pickup'
          ? `Send ${selectedItems.length} Item(s) to Laundry`
          : `Receive ${selectedItems.length} Item(s) from Laundry`}
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
