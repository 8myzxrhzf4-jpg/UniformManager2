import { useState, useMemo, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebase';
import { useCities, useInventory, useLogs, useGamePresenters, useAssignments, useLaundryOrders } from '../hooks';
import { Operations } from './Operations';
import { ImportExport } from './ImportExport';
import { HamperManagement } from './HamperManagement';
import { Analytics } from './Analytics';
import './Dashboard.css';
import { Package, Wrench, Repeat, ArrowLeftRight, BarChart3 } from 'lucide-react';

interface DashboardProps {
  user: User;
}

export function Dashboard({ user }: DashboardProps) {
  const { cities, loading: citiesLoading } = useCities();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedStudio, setSelectedStudio] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'inventory' | 'operations' | 'loaners' | 'import-export' | 'analytics'>('inventory');

  const { inventory, loading: inventoryLoading } = useInventory(selectedCity);
  // logs are scoped by studio display name (selectedStudioName)
  const { logs, loading: logsLoading } = useLogs(selectedCity, selectedStudioName());
  const { gps } = useGamePresenters();
  const { assignments } = useAssignments(selectedCity);
  const { laundryOrders } = useLaundryOrders(selectedCity);

  // ─── DERIVED DATA ───────────────────────────────────────────────────────────
  const cityList = useMemo(() =>
    Object.entries(cities).map(([key, city]) => ({ key, name: city.name })),
  [cities]);

  const studioList = useMemo(() => {
    if (!selectedCity || !cities[selectedCity]) return [];
    return Object.entries(cities[selectedCity].studios || {}).map(([key, studio]) => ({
      key,
      name: studio.name,
    }));
  }, [cities, selectedCity]);

  // Resolve display name of selected studio
  function selectedStudioName(): string | null {
    if (!selectedCity || !selectedStudio) return null;
    return cities[selectedCity]?.studios?.[selectedStudio]?.name ?? null;
  }

  const selectedStudioInfo = useMemo(() => {
    if (!selectedCity || !selectedStudio || !cities[selectedCity]) return null;
    return cities[selectedCity].studios?.[selectedStudio] ?? null;
  }, [cities, selectedCity, selectedStudio]);

  // Filter inventory by studio display name, not Firebase key
  const inventoryItems = useMemo(() => {
    const allItems = Object.entries(inventory).map(([key, item]) => ({ key, ...item }));
    const studioName = selectedStudioName();

    if (!studioName) {
      return allItems;
    }

    return allItems.filter(item =>
      (item.studioLocation ?? '').trim().toLowerCase() === studioName.trim().toLowerCase()
    );
  }, [inventory, selectedCity, selectedStudio, cities]);

  const logEntries = useMemo(() => {
    return Object.entries(logs || {})
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
          <h1>Uniform Manager</h1>
          <div className="user-info">
            <span className="user-email">{user.email}</span>
            <button onClick={handleSignOut} className="btn btn-secondary">Sign Out</button>
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
              <p className="empty-message">No cities found.</p>
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
                      <option key={city.key} value={city.key}>{city.name}</option>
                    ))}
                  </select>
                </div>

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
                        <option key={studio.key} value={studio.key}>{studio.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        <main className="main-content">
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
                <div className="tabs modern-tabs">
                  {[
                    { id: 'inventory', label: 'Inventory', icon: Package },
                    { id: 'operations', label: 'Operations', icon: Wrench },
                    { id: 'loaners', label: 'Loaners', icon: Repeat },
                    { id: 'import-export', label: 'Import/Export', icon: ArrowLeftRight },
                    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeView === tab.id;

                    return (
                      <button
                        key={tab.id}
                        className={`tab modern-tab ${isActive ? 'active' : ''}`}
                        onClick={() => setActiveView(tab.id as any)}
                        aria-pressed={isActive}
                        type="button"
                        title={tab.label}
                      >
                        <Icon size={18} strokeWidth={2} />
                        <span>{tab.label}</span>
                        {isActive && <div className="tab-underline" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Views */}
              {activeView === 'inventory' && (
                <>
                  <section className="inventory-section">
                    <h2>
                      Inventory
                      {!inventoryLoading && (
                        <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '0.75rem' }}>
                          ({inventoryItems.length} items{selectedStudioName() ? ` · ${selectedStudioName()}` : ` · ${cities[selectedCity]?.name}`})
                        </span>
                      )}
                    </h2>

                    {inventoryLoading ? (
                      <p>Loading inventory...</p>
                    ) : inventoryItems.length === 0 ? (
                      <p className="empty-message">
                        No inventory items found{selectedStudioName() ? ` for studio "${selectedStudioName()}"` : ''}.
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
                                  <span className={`status-badge status-${(item.status ?? '').toLowerCase().replace(/\s+/g, '-')}`}>
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

              {activeView === 'operations' && (
                <Operations
                  cityKey={selectedCity}
                  cityName={cities[selectedCity].name}
                  studioKey={selectedStudio || ''}
                  studioName={selectedStudioInfo?.name || ''}
                  inventory={inventory}
                  gps={gps}
                  studios={cities[selectedCity].studios || {}}
                  onRefresh={() => {}}
                />
              )}

              {activeView === 'loaners' && (
                <div className="active-loaners-section">
                  {/* Optional: mount the ActiveLoaners component if available */}
                </div>
              )}

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

              {activeView === 'analytics' && (
                <Analytics
                  cityKey={selectedCity}
                  cityName={cities[selectedCity].name}
                  studioKey={selectedStudio || ''}
                  studioName={selectedStudioInfo?.name || ''}
                  inventory={inventory}
                  assignments={assignments}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
