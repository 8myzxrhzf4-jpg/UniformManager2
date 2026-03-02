import { useState, useMemo } from 'react';
import { ref, update, set, get, push } from 'firebase/database';
import { db } from '../firebase';
import type { UserRecord, City } from '../types';
import { isFullAdmin, ALL_ROLES } from '../roles';
import './AdminPanel.css';

interface AdminPanelProps {
  users: Record<string, UserRecord>;
  cities: Record<string, City>;
  currentUserRole?: string;
  currentUserCities?: string[];
  onBack?: () => void;
}

export function AdminPanel({ users, cities, currentUserRole, currentUserCities = [], onBack }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'approvals' | 'cities'>('approvals');

  const hasFullAdmin = isFullAdmin(currentUserRole);
  const isCityAdminOnly = currentUserRole === 'City Admin';

  // Count pending users this admin can see
  const pendingCount = useMemo(() => Object.values(users).filter(u => {
    if (u.status !== 'pending') return false;
    if (hasFullAdmin) return true;
    return currentUserCities.some(ck => u.requestedCity === ck || (u.assignedCities || []).includes(ck));
  }).length, [users, hasFullAdmin, currentUserCities]);

  return (
    <div className="admin-panel card">
      <div className="admin-panel-header">
        <div className="admin-panel-title-row">
          {onBack && (
            <button className="btn-back" onClick={onBack} title="Back to dashboard">
              ← Back
            </button>
          )}
          <h2 className="text-accent">⚙️ Administration</h2>
        </div>
        {isCityAdminOnly && (
          <div className="city-admin-scope-badge">
            🏙️ City Admin — managing: {currentUserCities.map(k => cities[k]?.name || k).join(', ')}
          </div>
        )}
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => setActiveTab('approvals')}>
          👥 User Approvals
          {pendingCount > 0 && <span className="badge-count">{pendingCount}</span>}
        </button>
        {/* Cities & Studios: full admins see all cities + can add cities; City Admins see only their cities */}
        <button className={`tab ${activeTab === 'cities' ? 'active' : ''}`} onClick={() => setActiveTab('cities')}>
          🏙️ Cities & Studios
        </button>
      </div>

      {activeTab === 'approvals' && (
        <UserApprovals
          users={users}
          cities={cities}
          currentUserRole={currentUserRole}
          currentUserCities={currentUserCities}
        />
      )}
      {activeTab === 'cities' && (
        <CityStudioManager
          cities={cities}
          hasFullAdmin={hasFullAdmin}
          currentUserCities={currentUserCities}
        />
      )}
    </div>
  );
}

// ─── USER APPROVALS ───────────────────────────────────────────────────────────

function UserApprovals({
  users, cities, currentUserRole, currentUserCities = [],
}: {
  users: Record<string, UserRecord>;
  cities: Record<string, City>;
  currentUserRole?: string;
  currentUserCities?: string[];
}) {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadingUid, setLoadingUid] = useState<string | null>(null);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({});
  const [cityEdits, setCityEdits] = useState<Record<string, string[]>>({});

  const hasFullAdmin = isFullAdmin(currentUserRole);

  // Which roles can this admin assign?
  // A City Admin can only assign Staff or City Admin (for their own cities)
  // A full Admin can assign any role except Super User
  // Super User can assign any role
  const assignableRoles = useMemo(() => {
    if (currentUserRole === 'Super User') return ALL_ROLES;
    if (currentUserRole === 'Admin') return ALL_ROLES.filter(r => r !== 'Super User');
    if (currentUserRole === 'City Admin') return ['Staff', 'City Admin'] as const;
    return ['Staff'] as const;
  }, [currentUserRole]);

  // Which cities can this admin assign to other users?
  const assignableCities = useMemo(() => {
    const all = Object.entries(cities)
      .filter(([, city]) => city && city.name)
      .map(([key, city]) => ({ key, name: city.name }));
    if (hasFullAdmin) return all;
    // City Admin can only assign their own cities
    return all.filter(c => currentUserCities.includes(c.key));
  }, [cities, hasFullAdmin, currentUserCities]);

  // Filter users this admin can see
  const visibleUsers = useMemo(() => {
    return Object.entries(users).filter(([, u]) => {
      if (hasFullAdmin) return true;
      // City Admin sees users associated with their cities
      return currentUserCities.some(ck =>
        u.requestedCity === ck || (u.assignedCities || []).includes(ck)
      );
    });
  }, [users, hasFullAdmin, currentUserCities]);

  const pending = visibleUsers.filter(([, u]) => u.status === 'pending');
  const approved = visibleUsers.filter(([, u]) => u.status === 'approved');
  const rejected = visibleUsers.filter(([, u]) => u.status === 'rejected');

  const initEdit = (uid: string, user: UserRecord) => {
    setEditingUid(uid);
    setRoleEdits(prev => ({ ...prev, [uid]: user.role || 'Staff' }));
    setCityEdits(prev => ({ ...prev, [uid]: user.assignedCities || [] }));
  };

  const toggleCity = (uid: string, cityKey: string) => {
    setCityEdits(prev => {
      const current = prev[uid] || [];
      return {
        ...prev,
        [uid]: current.includes(cityKey)
          ? current.filter(k => k !== cityKey)
          : [...current, cityKey],
      };
    });
  };

  const handleApprove = async (uid: string) => {
    setLoadingUid(uid); setMessage(null);
    try {
      await update(ref(db), {
        [`users/${uid}/status`]: 'approved',
        [`users/${uid}/approvedAt`]: new Date().toISOString(),
        [`users/${uid}/role`]: roleEdits[uid] || 'Staff',
        [`users/${uid}/assignedCities`]: cityEdits[uid] || [],
      });
      setMessage({ type: 'success', text: '✓ Account approved.' });
      setEditingUid(null);
    } catch { setMessage({ type: 'error', text: 'Failed to approve account.' }); }
    finally { setLoadingUid(null); }
  };

  const handleReject = async (uid: string) => {
    if (!confirm('Reject this account request?')) return;
    setLoadingUid(uid);
    try {
      await update(ref(db, `users/${uid}`), { status: 'rejected' });
      setMessage({ type: 'success', text: 'Account rejected.' });
    } catch { setMessage({ type: 'error', text: 'Failed.' }); }
    finally { setLoadingUid(null); }
  };

  const handleUpdate = async (uid: string) => {
    setLoadingUid(uid);
    try {
      await update(ref(db, `users/${uid}`), {
        role: roleEdits[uid],
        assignedCities: cityEdits[uid] || [],
      });
      setMessage({ type: 'success', text: '✓ User updated.' });
      setEditingUid(null);
    } catch { setMessage({ type: 'error', text: 'Failed.' }); }
    finally { setLoadingUid(null); }
  };

  const UserCard = ({ uid, user, isPending }: { uid: string; user: UserRecord; isPending: boolean }) => {
    const isEditing = editingUid === uid;
    const userRoleMeta: Record<string, { color: string }> = {
      'Super User': { color: '#f59e0b' },
      'Admin':      { color: '#6366f1' },
      'City Admin': { color: '#10b981' },
      'Staff':      { color: '#6b7280' },
    };
    const roleColor = userRoleMeta[user.role]?.color || '#6b7280';

    return (
      <div className={`user-card ${isPending ? 'pending' : ''} ${isEditing ? 'editing' : ''}`}>
        {isEditing && (
          <div className="editing-banner">
            ✏️ Editing: <strong>{user.displayName || user.email}</strong>
          </div>
        )}
        <div className="user-card-header">
          <div className="user-card-identity">
            <strong className="user-display-name">{user.displayName || '—'}</strong>
            <span className="user-email-small">{user.email}</span>
            {user.requestedCity && cities[user.requestedCity] && (
              <span className="requested-city-tag">
                📍 Requested: {cities[user.requestedCity].name}
              </span>
            )}
          </div>
          <div className="user-card-chips">
            <span className={`status-chip status-${user.status}`}>{user.status}</span>
            {user.role && (
              <span className="role-chip" style={{ color: roleColor, borderColor: `${roleColor}55`, background: `${roleColor}15` }}>
                {user.role}
              </span>
            )}
          </div>
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
                {assignableRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <p className="field-hint">
                {roleEdits[uid] === 'City Admin' && '🏙️ City Admin: can approve users and manage settings for their assigned cities only.'}
                {roleEdits[uid] === 'Admin' && '🔑 Admin: full access to all cities and all admin functions.'}
                {roleEdits[uid] === 'Super User' && '👑 Super User: unrestricted platform access, can assign any role.'}
                {roleEdits[uid] === 'Staff' && '👤 Staff: operational access to assigned cities only.'}
              </p>
            </div>

            <div className="form-group">
              <label className="field-label">City Access</label>
              <p className="field-hint" style={{ marginBottom: '0.5rem' }}>
                {roleEdits[uid] === 'Admin' || roleEdits[uid] === 'Super User'
                  ? 'Admin/Super User have access to all cities automatically — city assignment not required.'
                  : 'Select which cities this user may access.'}
              </p>
              {(roleEdits[uid] === 'Staff' || roleEdits[uid] === 'City Admin') && (
                <div className="city-checkboxes">
                  {assignableCities.map(city => (
                    <label key={city.key} className="city-check">
                      <input
                        type="checkbox"
                        checked={(cityEdits[uid] || []).includes(city.key)}
                        onChange={() => toggleCity(uid, city.key)}
                      />
                      {city.name}
                    </label>
                  ))}
                  {assignableCities.length === 0 && (
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>No cities available</span>
                  )}
                </div>
              )}
            </div>

            <div className="button-row">
              {isPending ? (
                <>
                  <button className="btn btn-gold" onClick={() => handleApprove(uid)} disabled={loadingUid === uid}>
                    {loadingUid === uid ? '...' : '✓ Approve'}
                  </button>
                  <button className="btn btn-danger" onClick={() => handleReject(uid)} disabled={loadingUid === uid}>
                    Reject
                  </button>
                </>
              ) : (
                <button className="btn btn-gold" onClick={() => handleUpdate(uid)} disabled={loadingUid === uid}>
                  {loadingUid === uid ? '...' : 'Save Changes'}
                </button>
              )}
              <button className="btn btn-dark" onClick={() => setEditingUid(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="user-card-meta">
              <div className="meta-row">
                <span className="meta-label">Cities</span>
                <span className="meta-value">
                  {user.role === 'Admin' || user.role === 'Super User'
                    ? 'All cities'
                    : user.assignedCities?.length
                      ? user.assignedCities.map(k => cities[k]?.name || k).join(', ')
                      : 'None assigned'}
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Requested</span>
                <span className="meta-value">{user.requestedAt ? new Date(user.requestedAt).toLocaleDateString() : '—'}</span>
              </div>
              {user.approvedAt && (
                <div className="meta-row">
                  <span className="meta-label">Approved</span>
                  <span className="meta-value">{new Date(user.approvedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
            <div className="user-card-actions">
              <button className="btn btn-dark btn-sm" onClick={() => initEdit(uid, user)}>✏️ Edit</button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="user-approvals">
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {pending.length > 0 ? (
        <>
          <h3 className="section-subheading">⏳ Pending Approval ({pending.length})</h3>
          {pending.map(([uid, user]) => (
            <UserCard key={uid} uid={uid} user={user} isPending />
          ))}
        </>
      ) : (
        <div className="empty-inline">✓ No pending requests</div>
      )}

      {approved.length > 0 && (
        <>
          <h3 className="section-subheading" style={{ marginTop: '1.5rem' }}>
            ✅ Active Users ({approved.length})
          </h3>
          {approved.map(([uid, user]) => (
            <UserCard key={uid} uid={uid} user={user} isPending={false} />
          ))}
        </>
      )}

      {rejected.length > 0 && hasFullAdmin && (
        <>
          <h3 className="section-subheading" style={{ marginTop: '1.5rem', color: 'var(--color-error)' }}>
            ❌ Rejected ({rejected.length})
          </h3>
          {rejected.map(([uid, user]) => (
            <UserCard key={uid} uid={uid} user={user} isPending={false} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── CITY / STUDIO MANAGER — Full Admins only ────────────────────────────────

function CityStudioManager({
  cities,
  hasFullAdmin,
  currentUserCities = [],
}: {
  cities: Record<string, City>;
  hasFullAdmin: boolean;
  currentUserCities?: string[];
}) {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newCityName, setNewCityName] = useState('');
  const [addingStudio, setAddingStudio] = useState<string | null>(null);
  const [newStudioName, setNewStudioName] = useState('');
  const [newStudioCapacity, setNewStudioCapacity] = useState('20');
  const [loading, setLoading] = useState(false);

  // Edit studio state
  const [editingStudio, setEditingStudio] = useState<{ cityKey: string; studioKey: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [editCapacity, setEditCapacity] = useState('');

  // Delete studio state
  const [deletingStudio, setDeletingStudio] = useState<{ cityKey: string; studioKey: string; studioName: string } | null>(null);
  const [transferToStudio, setTransferToStudio] = useState('');

  // City Admins only see cities assigned to them; full admins see all
  // DB may store city names OR city keys in assignedCities — match both
  const visibleCities = useMemo(() => {
    const all = Object.entries(cities).filter(([, city]) => city && city.name);
    if (hasFullAdmin) return all;
    return all.filter(([key, city]) =>
      currentUserCities.includes(key) || currentUserCities.includes(city.name)
    );
  }, [cities, hasFullAdmin, currentUserCities]);

  const handleAddCity = async () => {
    if (!newCityName.trim()) return;
    setLoading(true); setMessage(null);
    try {
      const cityKey = newCityName.trim().toLowerCase().replace(/\s+/g, '_');
      await set(ref(db, `cities/${cityKey}`), {
        name: newCityName.trim(),
        studios: {
          main: {
            name: 'Main',
            hamperCapacity: 20,
            currentHamperCount: 0,
            homeStudio: true,
          },
        },
        laundryEnabled: true,
      });
      setMessage({ type: 'success', text: `✓ City "${newCityName.trim()}" created with a default "Main" studio.` });
      setNewCityName('');
    } catch { setMessage({ type: 'error', text: 'Failed to create city.' }); }
    finally { setLoading(false); }
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
      setNewStudioName(''); setNewStudioCapacity('20'); setAddingStudio(null);
    } catch { setMessage({ type: 'error', text: 'Failed to create studio.' }); }
    finally { setLoading(false); }
  };

  const handleToggleLaundry = async (cityKey: string, current: boolean) => {
    try {
      await update(ref(db, `cities/${cityKey}`), { laundryEnabled: !current });
      setMessage({ type: 'success', text: `Laundry system ${!current ? 'enabled' : 'disabled'} for ${cities[cityKey].name}.` });
    } catch { setMessage({ type: 'error', text: 'Failed to update setting.' }); }
  };

  const handleEditStudio = async () => {
    if (!editingStudio || !editName.trim()) return;
    setLoading(true);
    try {
      await update(ref(db, `cities/${editingStudio.cityKey}/studios/${editingStudio.studioKey}`), {
        name: editName.trim(),
        hamperCapacity: parseInt(editCapacity) || 20,
      });
      setMessage({ type: 'success', text: `✓ Studio updated to "${editName.trim()}".` });
      setEditingStudio(null);
    } catch { setMessage({ type: 'error', text: 'Failed to update studio.' }); }
    finally { setLoading(false); }
  };

  const handleDeleteStudio = async () => {
    if (!deletingStudio) return;
    const { cityKey, studioKey, studioName: delName } = deletingStudio;
    setLoading(true);
    try {
      // Check for inventory at this studio
      const invSnap = await get(ref(db, `inventory/${cityKey}`));
      const invData = invSnap.val() || {};
      const affectedKeys = Object.entries(invData)
        .filter(([, item]: [string, any]) =>
          (item.studioLocation || '').trim().toLowerCase() === delName.trim().toLowerCase()
        )
        .map(([k]) => k);

      if (affectedKeys.length > 0 && !transferToStudio) {
        setMessage({ type: 'error', text: `${affectedKeys.length} inventory item(s) are at this studio. Select a studio to transfer them to first.` });
        setLoading(false);
        return;
      }

      const updates: Record<string, any> = {};

      // Transfer inventory
      if (affectedKeys.length > 0 && transferToStudio) {
        const targetStudio = cities[cityKey]?.studios?.[transferToStudio];
        const targetName = targetStudio?.name || transferToStudio;
        affectedKeys.forEach(key => {
          updates[`inventory/${cityKey}/${key}/studioLocation`] = targetName;
        });
        // Log the transfer
        const logKey = push(ref(db, `logs/${cityKey}/${studioKey}`)).key;
        updates[`logs/${cityKey}/${studioKey}/${logKey}`] = {
          date: new Date().toISOString(),
          action: 'STUDIO_DELETE_TRANSFER',
          details: `Studio "${delName}" deleted. ${affectedKeys.length} item(s) transferred to "${targetName}".`,
        };
      }

      // Delete the studio
      updates[`cities/${cityKey}/studios/${studioKey}`] = null;

      await update(ref(db), updates);
      setMessage({ type: 'success', text: `✓ Studio "${delName}" deleted${affectedKeys.length > 0 ? ` — ${affectedKeys.length} item(s) transferred` : ''}.` });
      setDeletingStudio(null);
      setTransferToStudio('');
    } catch { setMessage({ type: 'error', text: 'Failed to delete studio.' }); }
    finally { setLoading(false); }
  };

  return (
    <div className="city-studio-manager">
      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {/* Only full admins can create new cities */}
      {hasFullAdmin && (
        <div className="add-city-form">
          <h3 className="section-subheading">➕ Add New City</h3>
          <div className="inline-form">
            <input type="text" value={newCityName} onChange={e => setNewCityName(e.target.value)}
              placeholder="City name (e.g. Las Vegas)" className="input-dark"
              onKeyDown={e => e.key === 'Enter' && handleAddCity()} />
            <button className="btn btn-gold" onClick={handleAddCity} disabled={loading || !newCityName.trim()}>
              Add City
            </button>
          </div>
        </div>
      )}

      <h3 className="section-subheading" style={{ marginTop: hasFullAdmin ? '1.5rem' : '0' }}>
        🏙️ {hasFullAdmin ? 'Existing Cities' : 'Your Cities'}
      </h3>

      {visibleCities.length === 0 && (
        <div className="empty-inline">No cities configured yet.</div>
      )}

      {visibleCities.map(([cityKey, city]) => {
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
                    title={laundryEnabled ? 'Click to disable' : 'Click to enable'}
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

            <div className="studios-list">
              {Object.entries(city.studios || {}).filter(([, s]) => s && s.name).map(([sk, studio]) => {
                const isEditing = editingStudio?.cityKey === cityKey && editingStudio?.studioKey === sk;
                return (
                  <div key={sk} className={`studio-chip ${isEditing ? 'studio-chip-editing' : ''}`}>
                    {isEditing ? (
                      <div className="studio-edit-inline">
                        <input
                          className="input-dark input-sm"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          placeholder="Studio name"
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleEditStudio()}
                        />
                        <input
                          className="input-dark input-sm"
                          type="number"
                          value={editCapacity}
                          onChange={e => setEditCapacity(e.target.value)}
                          placeholder="Cap"
                          style={{ width: '70px' }}
                        />
                        <button className="btn btn-gold btn-sm" onClick={handleEditStudio} disabled={loading}>Save</button>
                        <button className="btn btn-dark btn-sm" onClick={() => setEditingStudio(null)}>✕</button>
                      </div>
                    ) : (
                      <>
                        <span className="studio-chip-name">{studio.name}</span>
                        <span className="studio-capacity">Cap: {studio.hamperCapacity}</span>
                        {(studio as any).homeStudio && (
                          <span className="studio-home-badge">🏠 Home</span>
                        )}
                        <button
                          className="studio-home-toggle"
                          title={(studio as any).homeStudio ? 'Remove home studio' : 'Set as home studio'}
                          onClick={async () => {
                            try {
                              await update(ref(db, `cities/${cityKey}/studios/${sk}`), {
                                homeStudio: !(studio as any).homeStudio,
                              });
                              setMessage({ type: 'success', text: `${studio.name} ${!(studio as any).homeStudio ? 'set as' : 'removed as'} home studio.` });
                            } catch { setMessage({ type: 'error', text: 'Failed to update home studio.' }); }
                          }}
                        >
                          {(studio as any).homeStudio ? '★' : '☆'}
                        </button>
                        <button
                          className="studio-action-btn"
                          title="Edit studio"
                          onClick={() => {
                            setEditingStudio({ cityKey, studioKey: sk });
                            setEditName(studio.name);
                            setEditCapacity(String(studio.hamperCapacity ?? 20));
                          }}
                        >✏️</button>
                        <button
                          className="studio-action-btn studio-delete-btn"
                          title="Delete studio"
                          onClick={() => {
                            setDeletingStudio({ cityKey, studioKey: sk, studioName: studio.name });
                            setTransferToStudio('');
                          }}
                        >🗑️</button>
                      </>
                    )}
                  </div>
                );
              })}
              {Object.keys(city.studios || {}).length === 0 && (
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>No studios yet</span>
              )}
            </div>

            {/* Delete confirmation modal */}
            {deletingStudio && deletingStudio.cityKey === cityKey && (() => {
              const otherStudios = Object.entries(city.studios || {})
                .filter(([sk]) => sk !== deletingStudio.studioKey)
                .filter(([, s]) => s && s.name);
              return (
                <div className="studio-delete-modal">
                  <div className="studio-delete-modal-box">
                    <h4>Delete Studio "{deletingStudio.studioName}"?</h4>
                    {otherStudios.length > 0 ? (
                      <>
                        <p className="text-muted">If this studio has inventory, select a studio to transfer it to:</p>
                        <select
                          className="input-dark"
                          value={transferToStudio}
                          onChange={e => setTransferToStudio(e.target.value)}
                        >
                          <option value="">— No transfer needed / skip —</option>
                          {otherStudios.map(([sk, s]) => (
                            <option key={sk} value={sk}>{s.name}</option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <p className="text-muted">This is the only studio. Any inventory here will remain in the city.</p>
                    )}
                    <div className="studio-delete-actions">
                      <button
                        className="btn btn-gold btn-sm"
                        onClick={handleDeleteStudio}
                        disabled={loading}
                      >
                        {loading ? 'Deleting…' : 'Confirm Delete'}
                      </button>
                      <button
                        className="btn btn-dark btn-sm"
                        onClick={() => { setDeletingStudio(null); setTransferToStudio(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {addingStudio === cityKey ? (
              <div className="add-studio-form">
                <input type="text" value={newStudioName} onChange={e => setNewStudioName(e.target.value)}
                  placeholder="Studio name" className="input-dark input-sm" autoFocus />
                <input type="number" value={newStudioCapacity} onChange={e => setNewStudioCapacity(e.target.value)}
                  placeholder="Hamper capacity" className="input-dark input-sm" style={{ width: '130px' }} />
                <button className="btn btn-gold btn-sm" onClick={() => handleAddStudio(cityKey)} disabled={loading}>Add</button>
                <button className="btn btn-dark btn-sm" onClick={() => setAddingStudio(null)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-dark btn-sm" style={{ marginTop: '0.5rem' }}
                onClick={() => { setAddingStudio(cityKey); setNewStudioName(''); }}>
                + Add Studio
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
