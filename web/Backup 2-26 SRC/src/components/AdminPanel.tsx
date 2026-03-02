import { useState } from 'react';
import { ref, update, push, set } from 'firebase/database';
import { db } from '../firebase';
import type { UserRecord, City } from '../types';
import { Users, MapPin } from 'lucide-react';
import './AdminPanel.css';

interface AdminPanelProps {
  users: Record<string, UserRecord>;
  cities: Record<string, City>;
}

const ROLES = ['Staff', 'Auditor', 'Admin', 'Super User'] as const;

export function AdminPanel({ users, cities }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'approvals' | 'cities'>('approvals');

  return (
    <div className="admin-panel card">
      <h2 className="text-accent">⚙️ Administration</h2>

      <div className="tabs">
        <button className={`tab ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => setActiveTab('approvals')}>
          👥 User Approvals
          {Object.values(users).filter(u => u.status === 'pending').length > 0 && (
            <span className="badge-count">{Object.values(users).filter(u => u.status === 'pending').length}</span>
          )}
        </button>
        <button className={`tab ${activeTab === 'cities' ? 'active' : ''}`} onClick={() => setActiveTab('cities')}>
          🏙️ Cities & Studios
        </button>
      </div>

      {activeTab === 'approvals' && <UserApprovals users={users} cities={cities} />}
      {activeTab === 'cities' && <CityStudioManager cities={cities} />}
    </div>
  );
}

// ─── USER APPROVALS ───────────────────────────────────────────────────────────

function UserApprovals({ users, cities }: { users: Record<string, UserRecord>; cities: Record<string, City> }) {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadingUid, setLoadingUid] = useState<string | null>(null);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({});
  const [cityEdits, setCityEdits] = useState<Record<string, string[]>>({});

  const pending = Object.entries(users).filter(([, u]) => u.status === 'pending');
  const approved = Object.entries(users).filter(([, u]) => u.status === 'approved');

  const cityList = Object.entries(cities).map(([key, city]) => ({ key, name: city.name }));

  const initEdit = (uid: string, user: UserRecord) => {
    setEditingUid(uid);
    setRoleEdits(prev => ({ ...prev, [uid]: user.role }));
    setCityEdits(prev => ({ ...prev, [uid]: user.assignedCities || [] }));
  };

  const toggleCity = (uid: string, cityKey: string) => {
    setCityEdits(prev => {
      const current = prev[uid] || [];
      return {
        ...prev,
        [uid]: current.includes(cityKey) ? current.filter(k => k !== cityKey) : [...current, cityKey],
      };
    });
  };

  const handleApprove = async (uid: string) => {
    setLoadingUid(uid);
    setMessage(null);
    try {
      const updates: Record<string, any> = {
        [`users/${uid}/status`]: 'approved',
        [`users/${uid}/approvedAt`]: new Date().toISOString(),
        [`users/${uid}/role`]: roleEdits[uid] || 'Staff',
        [`users/${uid}/assignedCities`]: cityEdits[uid] || [],
      };
      await update(ref(db), updates);
      setMessage({ type: 'success', text: '✓ Account approved.' });
      setEditingUid(null);
    } catch {
      setMessage({ type: 'error', text: 'Failed to approve account.' });
    } finally { setLoadingUid(null); }
  };

  const handleReject = async (uid: string) => {
    if (!confirm('Reject this account request?')) return;
    setLoadingUid(uid);
    try {
      await update(ref(db, `users/${uid}`), { status: 'rejected' });
      setMessage({ type: 'success', text: 'Account rejected.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed.' });
    } finally { setLoadingUid(null); }
  };

  const handleUpdateApproved = async (uid: string) => {
    setLoadingUid(uid);
    try {
      await update(ref(db, `users/${uid}`), {
        role: roleEdits[uid],
        assignedCities: cityEdits[uid] || [],
      });
      setMessage({ type: 'success', text: '✓ User updated.' });
      setEditingUid(null);
    } catch {
      setMessage({ type: 'error', text: 'Failed.' });
    } finally { setLoadingUid(null); }
  };

  const UserCard = ({ uid, user, isPending }: { uid: string; user: UserRecord; isPending: boolean }) => {
    const isEditing = editingUid === uid;
    return (
      <div className={`user-card ${isPending ? 'pending' : ''}`}>
        <div className="user-card-header">
          <div>
            <strong>{user.displayName || '—'}</strong>
            <span className="user-email-small">{user.email}</span>
          </div>
          <span className={`status-chip status-${user.status}`}>{user.status}</span>
        </div>

        {isEditing ? (
          <div className="user-edit-form">
            <div className="form-group">
              <label className="field-label">Role</label>
              <select
                className="input-dark"
                value={roleEdits[uid] || 'Staff'}
                onChange={e => setRoleEdits(prev => ({ ...prev, [uid]: e.target.value }))}
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="field-label">City Access</label>
              <div className="city-checkboxes">
                {cityList.map(city => (
                  <label key={city.key} className="city-check">
                    <input
                      type="checkbox"
                      checked={(cityEdits[uid] || []).includes(city.key)}
                      onChange={() => toggleCity(uid, city.key)}
                    />
                    {city.name}
                  </label>
                ))}
                {cityList.length === 0 && <span className="text-muted" style={{ fontSize: '0.8rem' }}>No cities configured yet</span>}
              </div>
            </div>
            <div className="button-row">
              {isPending ? (
                <>
                  <button className="btn btn-gold" onClick={() => handleApprove(uid)} disabled={loadingUid === uid}>
                    {loadingUid === uid ? '...' : '✓ Approve'}
                  </button>
                  <button className="btn btn-danger" onClick={() => handleReject(uid)} disabled={loadingUid === uid}>Reject</button>
                </>
              ) : (
                <button className="btn btn-gold" onClick={() => handleUpdateApproved(uid)} disabled={loadingUid === uid}>
                  {loadingUid === uid ? '...' : 'Save Changes'}
                </button>
              )}
              <button className="btn btn-dark" onClick={() => setEditingUid(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="user-card-meta">
            <span className="meta-item">Role: <strong>{user.role}</strong></span>
            <span className="meta-item">Cities: <strong>{user.assignedCities?.length ? user.assignedCities.map(k => cities[k]?.name || k).join(', ') : 'None'}</strong></span>
            <span className="meta-item">Requested: {new Date(user.requestedAt).toLocaleDateString()}</span>
            <button className="btn btn-dark btn-sm" onClick={() => initEdit(uid, user)}>Edit</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="user-approvals">
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {pending.length > 0 && (
        <>
          <h3 className="section-subheading">⏳ Pending Approval ({pending.length})</h3>
          {pending.map(([uid, user]) => (
            <UserCard key={uid} uid={uid} user={user} isPending />
          ))}
        </>
      )}

      {pending.length === 0 && (
        <div className="empty-inline">✓ No pending requests</div>
      )}

      {approved.length > 0 && (
        <>
          <h3 className="section-subheading" style={{ marginTop: '1.5rem' }}>✅ Approved Users ({approved.length})</h3>
          {approved.map(([uid, user]) => (
            <UserCard key={uid} uid={uid} user={user} isPending={false} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── CITY / STUDIO MANAGER ────────────────────────────────────────────────────

function CityStudioManager({ cities }: { cities: Record<string, City> }) {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newCityName, setNewCityName] = useState('');
  const [addingStudio, setAddingStudio] = useState<string | null>(null);
  const [newStudioName, setNewStudioName] = useState('');
  const [newStudioCapacity, setNewStudioCapacity] = useState('20');
  const [loading, setLoading] = useState(false);

  const handleAddCity = async () => {
    if (!newCityName.trim()) return;
    setLoading(true); setMessage(null);
    try {
      const cityKey = newCityName.trim().toLowerCase().replace(/\s+/g, '_');
      await set(ref(db, `cities/${cityKey}`), {
        name: newCityName.trim(),
        studios: {},
        laundryEnabled: true,
      });
      setMessage({ type: 'success', text: `✓ City "${newCityName.trim()}" created.` });
      setNewCityName('');
    } catch {
      setMessage({ type: 'error', text: 'Failed to create city.' });
    } finally { setLoading(false); }
  };

  const handleAddStudio = async (cityKey: string) => {
    if (!newStudioName.trim()) return;
    setLoading(true); setMessage(null);
    try {
      const studioKey = newStudioName.trim().toLowerCase().replace(/\s+/g, '_');
      await set(ref(db, `cities/${cityKey}/studios/${studioKey}`), {
        name: newStudioName.trim(),
        hamperCapacity: parseInt(newStudioCapacity) || 20,
        currentHamperCount: 0,
      });
      setMessage({ type: 'success', text: `✓ Studio "${newStudioName.trim()}" added.` });
      setNewStudioName('');
      setNewStudioCapacity('20');
      setAddingStudio(null);
    } catch {
      setMessage({ type: 'error', text: 'Failed to create studio.' });
    } finally { setLoading(false); }
  };

  const handleToggleLaundry = async (cityKey: string, current: boolean) => {
    try {
      await update(ref(db, `cities/${cityKey}`), { laundryEnabled: !current });
      setMessage({ type: 'success', text: `Laundry system ${!current ? 'enabled' : 'disabled'} for ${cities[cityKey].name}.` });
    } catch {
      setMessage({ type: 'error', text: 'Failed to update setting.' });
    }
  };

  return (
    <div className="city-studio-manager">
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {/* Add new city */}
      <div className="add-city-form">
        <h3 className="section-subheading">➕ Add New City</h3>
        <div className="inline-form">
          <input
            type="text"
            value={newCityName}
            onChange={e => setNewCityName(e.target.value)}
            placeholder="City name (e.g. Las Vegas)"
            className="input-dark"
            onKeyDown={e => e.key === 'Enter' && handleAddCity()}
          />
          <button className="btn btn-gold" onClick={handleAddCity} disabled={loading || !newCityName.trim()}>
            Add City
          </button>
        </div>
      </div>

      {/* Existing cities */}
      <h3 className="section-subheading" style={{ marginTop: '1.5rem' }}>🏙️ Existing Cities</h3>

      {Object.entries(cities).length === 0 && (
        <div className="empty-inline">No cities configured yet.</div>
      )}

      {Object.entries(cities).map(([cityKey, city]) => {
        const laundryEnabled = city.laundryEnabled !== false;
        return (
          <div key={cityKey} className="city-card">
            <div className="city-card-header">
              <h4>{city.name}</h4>
              <div className="city-card-controls">
                <label className="laundry-toggle-label">
                  <span>🧺 Laundry System</span>
                  <div
                    className={`toggle-switch ${laundryEnabled ? 'on' : 'off'}`}
                    onClick={() => handleToggleLaundry(cityKey, laundryEnabled)}
                    title={laundryEnabled ? 'Click to disable laundry (returns go directly to Available)' : 'Click to enable laundry system'}
                  >
                    <div className="toggle-knob" />
                  </div>
                  <span className="toggle-state">{laundryEnabled ? 'On' : 'Off'}</span>
                </label>
              </div>
            </div>

            {!laundryEnabled && (
              <div className="laundry-off-notice">
                ⚠️ Laundry OFF — returned items skip hamper and go directly to Available.
              </div>
            )}

            {/* Studios list */}
            <div className="studios-list">
              {Object.entries(city.studios || {}).map(([sk, studio]) => (
                <div key={sk} className="studio-chip">
                  <span>{studio.name}</span>
                  <span className="studio-capacity">Cap: {studio.hamperCapacity}</span>
                </div>
              ))}
              {Object.keys(city.studios || {}).length === 0 && (
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>No studios yet</span>
              )}
            </div>

            {/* Add studio inline */}
            {addingStudio === cityKey ? (
              <div className="add-studio-form">
                <input
                  type="text"
                  value={newStudioName}
                  onChange={e => setNewStudioName(e.target.value)}
                  placeholder="Studio name"
                  className="input-dark input-sm"
                  autoFocus
                />
                <input
                  type="number"
                  value={newStudioCapacity}
                  onChange={e => setNewStudioCapacity(e.target.value)}
                  placeholder="Hamper capacity"
                  className="input-dark input-sm"
                  style={{ width: '130px' }}
                />
                <button className="btn btn-gold btn-sm" onClick={() => handleAddStudio(cityKey)} disabled={loading}>Add</button>
                <button className="btn btn-dark btn-sm" onClick={() => setAddingStudio(null)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-dark btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => { setAddingStudio(cityKey); setNewStudioName(''); }}>
                + Add Studio
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
