import { useState } from 'react';
import { ref, update, push } from 'firebase/database';
import { db } from '../firebase';
import './HamperManagement.css';

interface HamperManagementProps {
  cityKey: string;
  cityName: string;
  studioKey: string;
  studioName: string;
  hamperCapacity: number;
  currentHamperCount: number;
  onRefresh?: () => void;
}

export function HamperManagement({
  cityKey,
  studioKey,
  hamperCapacity,
  currentHamperCount,
  onRefresh,
}: HamperManagementProps) {
  if (!cityKey || String(cityKey).trim() === "") {
    return (
      <div className="operation-content">
        <p className="empty-message">Please select a City and Studio from the sidebar to manage hampers.</p>
      </div>
    );
  }
  const [isEditing, setIsEditing] = useState(false);
  const [newCapacity, setNewCapacity] = useState(hamperCapacity.toString());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const utilizationPercent = hamperCapacity > 0 ? (currentHamperCount / hamperCapacity) * 100 : 0;
  const isOverCapacity = currentHamperCount > hamperCapacity;

  const handleUpdateCapacity = async () => {
    const capacity = parseInt(newCapacity, 10);
    
    if (isNaN(capacity) || capacity < 0) {
      setMessage({ type: 'error', text: 'Please enter a valid capacity (0 or greater)' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const updates: Record<string, any> = {};
      const timestamp = new Date().toISOString();

      // Update hamper capacity
      updates[`cities/${cityKey}/studios/${studioKey}/hamperCapacity`] = capacity;

      // Log the change
      const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
      updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
        date: timestamp,
        action: 'HAMPER_CAPACITY_UPDATE',
        details: `Updated hamper capacity from ${hamperCapacity} to ${capacity}`,
      };

      await update(ref(db), updates);

      // Warn if current count exceeds new capacity
      if (currentHamperCount > capacity) {
        setMessage({
          type: 'warning',
          text: `Capacity updated to ${capacity}. Warning: Current count (${currentHamperCount}) exceeds new capacity!`,
        });
      } else {
        setMessage({ type: 'success', text: `Hamper capacity updated to ${capacity}` });
      }

      setIsEditing(false);
      
      if (onRefresh) {
        setTimeout(onRefresh, 500);
      }
    } catch (error) {
      console.error('Update capacity error:', error);
      setMessage({ type: 'error', text: 'Failed to update capacity. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hamper-management card">
      <div className="hamper-header">
        <h3 className="text-accent">Hamper Status</h3>
        {!isEditing && (
          <button
            onClick={() => {
              setIsEditing(true);
              setNewCapacity(hamperCapacity.toString());
              setMessage(null);
            }}
            className="btn-outline btn-sm"
          >
            Edit Capacity
          </button>
        )}
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="hamper-stats">
        <div className="stat-item">
          <span className="stat-label">Current Count</span>
          <span className={`stat-value ${isOverCapacity ? 'text-error' : ''}`}>
            {currentHamperCount}
          </span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">Capacity</span>
          {isEditing ? (
            <div className="capacity-edit">
              <input
                type="number"
                value={newCapacity}
                onChange={(e) => setNewCapacity(e.target.value)}
                min="0"
                className="input-dark capacity-input"
                disabled={loading}
              />
              <div className="edit-buttons">
                <button
                  onClick={handleUpdateCapacity}
                  disabled={loading}
                  className="btn btn-gold btn-sm"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setNewCapacity(hamperCapacity.toString());
                    setMessage(null);
                  }}
                  disabled={loading}
                  className="btn btn-dark btn-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <span className="stat-value">{hamperCapacity}</span>
          )}
        </div>

        <div className="stat-item">
          <span className="stat-label">Utilization</span>
          <span className={`stat-value ${isOverCapacity ? 'text-error' : ''}`}>
            {utilizationPercent.toFixed(0)}%
          </span>
        </div>
      </div>

      {!isEditing && (
        <div className="hamper-progress">
          <div 
            className={`progress-bar ${isOverCapacity ? 'over-capacity' : ''}`}
            style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
          />
        </div>
      )}

      {isOverCapacity && !isEditing && (
        <div className="alert alert-warning">
          <strong>Warning:</strong> Hamper count ({currentHamperCount}) exceeds capacity ({hamperCapacity})
        </div>
      )}
    </div>
  );
}