import { useState, useMemo, useEffect } from 'react';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { auth, db } from '../firebase';
import { useCities, useInventory, useLogs, useGamePresenters, useAssignments, useLaundryOrders, useUserRecords, useAllAssignments } from '../hooks';
import { Operations } from './Operations';
import { ImportExport } from './ImportExport';
import { HamperManagement } from './HamperManagement';
import { Analytics } from './Analytics';
import { AdminPanel } from './AdminPanel';
import { GPLookup } from './GPLookup';
import { ActiveLoaners } from './ActiveLoaners';
import { SizeSuggestion } from './SizeSuggestion';
import type { UserRecord } from '../types';
import logoUrl from '../assets/logo.webp';
import './Dashboard.css';

interface DashboardProps {
  user: User;
}

export function Dashboard({ user }: DashboardProps) {
  const { cities, loading: citiesLoading } = useCities();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedStudio, setSelectedStudio] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'inventory' | 'operations' | 'loaners' | 'import-export' | 'analytics' | 'gp-lookup' | 'admin'>('inventory');
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null);

  const { inventory, loading: inventoryLoading } = useInventory(selectedCity);
  const { logs, loading: logsLoading } = useLogs(selectedCity, selectedStudioName());
  const { gps } = useGamePresenters();
  const { assignments } = useAssignments(selectedCity);
  const { laundryOrders } = useLaundryOrders(selectedCity);
  const { users } = useUserRecords();
  const { assignments: allAssignments } = useAllAssignments();

  // Load current user's record to check role
  useEffect(() => {
    if (!user?.uid) return;
    get(ref(db, `users/${user.uid}`)).then(snap => {
      if (snap.exists()) setUserRecord(snap.val());
    });
  }, [user?.uid]);

  const isAdmin = userRecord?.role === 'Admin' || userRecord?.role === 'Super User';
  const pendingCount = Object.values(users).filter(u => u.status === 'pending').length;

  // ─── DERIVED DATA ───────────────────────────────────────────────────────────

  const cityList = useMemo(() => {
    const all = Object.entries(cities).map(([key, city]) => ({ key, name: city.name }));
    // Filter by assigned cities for non-admins
    if (isAdmin || !userRecord?.assignedCities?.length) return all;
    return all.filter(c => userRecord.assignedCities!.includes(c.key));
  }, [cities, isAdmin, userRecord]);

  const studioList = useMemo(() => {
    if (!selectedCity || !cities[selectedCity]) return [];
    return Object.entries(cities[selectedCity].studios || {}).map(([key, studio]) => ({
      key,
      name: studio.name,
    }));
  }, [cities, selectedCity]);

  function selectedStudioName(): string | null {
    if (!selectedCity || !selectedStudio) return null;
    return cities[selectedCity]?.studios?.[selectedStudio]?.name ?? null;
  }

  const selectedStudioInfo = useMemo(() => {
    if (!selectedCity || !selectedStudio || !cities[selectedCity]) return null;
    return cities[selectedCity].studios?.[selectedStudio] ?? null;
  }, [cities, selectedCity, selectedStudio]);

  const laundryEnabled = selectedCity ? (cities[selectedCity]?.laundryEnabled !== false) : true;

  const inventoryItems = useMemo(() => {
    const allItems = Object.entries(inventory).map(([key, item]) => ({ key, ...item }));
    const studioName = selectedStudioName();
    if (!studioName) return allItems;
    return allItems.filter(item =>
      item.studioLocation?.trim().toLowerCase() === studioName.trim().toLowerCase()
    );
  }, [inventory, selectedCity, selectedStudio, cities]);

  const logEntries = useMemo(() => {
    return Object.entries(logs)
      .map(([key, log]) => ({ key, ...log }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [logs]);

  // ─── HANDLERS ───────────────────────────────────────────────────────────────

  const handleSignOut = async () => {
    try { await signOut(auth); }
    catch (error) { console.error('Sign out error:', error); }
  };

  const handleCityChange = (cityKey: string) => {
    setSelectedCity(cityKey || null);
    setSelectedStudio(null);
  };

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-brand">
            <img src={logoUrl} alt="Logo" className="header-logo" />
            <h1>Uniform Manager</h1>
          </div>
          <div className="user-info">
            <span className="user-email">{user.email}</span>
            {userRecord?.role && <span className="user-role-badge">{userRecord.role}</span>}
            <button onClick={handleSignOut} className="btn btn-secondary">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        <aside className="sidebar">
          <div className="selector-section">
            <h3>Select Location</h3>

            {citiesLoading ? (
              <p>Loading cities...</p>
            ) : cityList.length === 0 ? (
              <p className="empty-message">No cities available for your account.</p>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="city-select">City</label>
                  <select
                    id="city-select"
                    value={selectedCity || ''}
                    onChange={e => handleCityChange(e.target.value)}
                    className="select-input"
                  >
                    <option value="">Select a city...</option>
                    {cityList.map(city => (
                      <option key={city.key} value={city.key}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCity && !laundryEnabled && (
                  <div className="laundry-off-banner">
                    🚫 Laundry system disabled — returns go directly to Available
                  </div>
                )}

                {selectedCity && (
                  <div className="form-group">
                    <label htmlFor="studio-select">Studio</label>
                    <select
                      id="studio-select"
                      value={selectedStudio || ''}
                      onChange={e => setSelectedStudio(e.target.value || null)}
                      className="select-input"
                    >
                      <option value="">All Studios</option>
                      {studioList.map(studio => (
                        <option key={studio.key} value={studio.key}>
                          {studio.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedCity && inventoryItems.length === 0 && !inventoryLoading && (
                  <p className="empty-message" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    No items found. City key: "<strong>{selectedCity}</strong>"
                    {selectedStudioName() && <> | Studio: "<strong>{selectedStudioName()}</strong>"</>}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Quick nav for global features */}
          <div className="sidebar-nav">
            <button
              className={`sidebar-nav-btn ${activeView === 'gp-lookup' ? 'active' : ''}`}
              onClick={() => setActiveView('gp-lookup')}
            >
              🔍 GP Lookup
            </button>
            {isAdmin && (
              <button
                className={`sidebar-nav-btn ${activeView === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveView('admin')}
              >
                ⚙️ Admin
                {pendingCount > 0 && <span className="sidebar-badge">{pendingCount}</span>}
              </button>
            )}
          </div>
        </aside>

        <main className="main-content">
          {/* ── GP LOOKUP (global) ── */}
          {activeView === 'gp-lookup' && (
            <GPLookup gps={gps} allAssignments={allAssignments} cities={cities} />
          )}

          {/* ── ADMIN ── */}
          {activeView === 'admin' && isAdmin && (
            <AdminPanel users={users} cities={cities} />
          )}

          {/* ── CITY VIEWS ── */}
          {activeView !== 'gp-lookup' && activeView !== 'admin' && (
            <>
              {!selectedCity ? (
                <div className="empty-state">
                  <h2>Welcome to Uniform Manager</h2>
                  <p>Select a city from the sidebar to get started.</p>
                </div>
              ) : (
                <>
                  {selectedStudio && selectedStudioInfo && (
                    <HamperManagement
                      cityKey={selectedCity}
                      cityName={cities[selectedCity].name}
                      studioKey={selectedStudio}
                      studioName={selectedStudioInfo.name}
                      hamperCapacity={selectedStudioInfo.hamperCapacity}
                      currentHamperCount={selectedStudioInfo.currentHamperCount}
                    />
                  )}

                  {/* Navigation Tabs */}
                  <div className="view-tabs card">
                    <div className="tabs">
                      {(['inventory', 'operations', 'loaners', 'import-export', 'analytics'] as const).map(view => (
                        <button
                          key={view}
                          className={`tab ${activeView === view ? 'active' : ''}`}
                          onClick={() => setActiveView(view)}
                        >
                          {view === 'import-export' ? 'Import/Export'
                            : view === 'loaners' ? '🔄 Loaners'
                            : view.charAt(0).toUpperCase() + view.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── INVENTORY ── */}
                  {activeView === 'inventory' && (
                    <>
                      <section className="inventory-section">
                        <h2>
                          Inventory
                          {!inventoryLoading && (
                            <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '0.75rem' }}>
                              ({inventoryItems.length} items
                              {selectedStudioName() ? ` in ${selectedStudioName()}` : ` in ${cities[selectedCity]?.name}`})
                            </span>
                          )}
                        </h2>

                        {inventoryLoading ? (
                          <p>Loading inventory...</p>
                        ) : inventoryItems.length === 0 ? (
                          <p className="empty-message">
                            No inventory items found
                            {selectedStudioName()
                              ? ` for studio "${selectedStudioName()}"`
                              : ` for ${cities[selectedCity]?.name}`}.
                          </p>
                        ) : (
                          <div className="table-container">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>Size</th>
                                  <th>Barcode</th>
                                  <th>Status</th>
                                  <th>Studio</th>
                                </tr>
                              </thead>
                              <tbody>
                                {inventoryItems.map(item => (
                                  <tr key={item.key}>
                                    <td>{item.name}</td>
                                    <td>{item.size}</td>
                                    <td><code className="barcode">{item.barcode}</code></td>
                                    <td>
                                      <span className={`status-badge status-${item.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                                        {item.status}
                                      </span>
                                    </td>
                                    <td>{item.studioLocation}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>

                      <section className="logs-section">
                        <h2>Activity Logs</h2>
                        <p className="section-description">Most recent first</p>
                        {logsLoading ? (
                          <p>Loading logs...</p>
                        ) : logEntries.length === 0 ? (
                          <p className="empty-message">No logs found for this location.</p>
                        ) : (
                          <div className="logs-list">
                            {logEntries.map(log => (
                              <div key={log.key} className="log-entry">
                                <div className="log-header">
                                  <span className="log-date">{log.date}</span>
                                  <span className="log-action">{log.action}</span>
                                </div>
                                <div className="log-details">{log.details}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </>
                  )}

                  {/* ── OPERATIONS ── */}
                  {activeView === 'operations' && (
                    <Operations
                      cityKey={selectedCity}
                      cityName={cities[selectedCity].name}
                      studioKey={selectedStudio || ''}
                      studioName={selectedStudioInfo?.name || ''}
                      inventory={inventory}
                      gps={gps}
                      studios={cities[selectedCity].studios || {}}
                      laundryEnabled={laundryEnabled}
                      onRefresh={() => {}}
                    />
                  )}

                  {/* ── ACTIVE LOANERS ── */}
                  {activeView === 'loaners' && (
                    <ActiveLoaners
                      assignments={assignments}
                      inventory={inventory}
                      studioName={selectedStudioInfo?.name}
                    />
                  )}

                  {/* ── IMPORT / EXPORT ── */}
                  {activeView === 'import-export' && (
                    <ImportExport
                      cityKey={selectedCity}
                      cityName={cities[selectedCity].name}
                      studioKey={selectedStudio || ''}
                      studioName={selectedStudioInfo?.name || ''}
                      inventory={inventory}
                      assignments={assignments}
                      laundryOrders={laundryOrders}
                      logs={logs}
                      gamePresenters={gps}
                    />
                  )}

                  {/* ── ANALYTICS ── */}
                  {activeView === 'analytics' && (
                    <>
                      <Analytics
                        cityKey={selectedCity}
                        cityName={cities[selectedCity].name}
                        studioKey={selectedStudio || ''}
                        studioName={selectedStudioInfo?.name || ''}
                        inventory={inventory}
                        assignments={assignments}
                      />
                      <SizeSuggestion
                        gps={gps}
                        allAssignments={allAssignments}
                        inventory={inventory}
                      />
                    </>
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
