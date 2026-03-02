import { useState, useMemo, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { auth, db } from '../firebase';
import {
  useCities, useInventory, useLogs, useGamePresenters,
  useAssignments, useLaundryOrders, useUserRecords, useAllAssignments,
} from '../hooks';
import { Operations } from './Operations';
import { ImportExport } from './ImportExport';
import { HamperManagement } from './HamperManagement';
import { Analytics } from './Analytics';
import { AdminPanel } from './AdminPanel';
import { GPLookup } from './GPLookup';
import { ActiveLoaners } from './ActiveLoaners';
import { SizeSuggestion } from './SizeSuggestion';
import type { UserRecord } from '../types';
import { isFullAdmin, isAnyAdmin, canSeeAllCities, roleMeta } from '../roles';
import logoUrl from '../assets/logo.png';
import './Dashboard.css';
import { Package, Wrench, Repeat, ArrowLeftRight, BarChart3, Ruler, Search, Settings } from 'lucide-react';

interface DashboardProps { user: User; }

type ActiveView =
  | 'inventory' | 'operations' | 'loaners' | 'import-export'
  | 'analytics' | 'size-guide' | 'gp-lookup' | 'admin';

export function Dashboard({ user }: DashboardProps) {
  const { cities, loading: citiesLoading } = useCities();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedStudio, setSelectedStudio] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('inventory');
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null);

  const { inventory, loading: inventoryLoading } = useInventory(selectedCity);
  const { logs, loading: logsLoading } = useLogs(selectedCity, selectedStudioName());
  const { gps } = useGamePresenters();
  const { assignments } = useAssignments(selectedCity);
  const { laundryOrders } = useLaundryOrders(selectedCity);
  const { users } = useUserRecords();
  const { assignments: allAssignments } = useAllAssignments();

  useEffect(() => {
    if (!user?.uid) return;
    if (users[user.uid]) setUserRecord(prev => prev ?? users[user.uid]);
    get(ref(db, `users/${user.uid}`)).then(snap => {
      if (snap.exists()) setUserRecord(snap.val());
    });
  }, [user?.uid, users]);

  // Auto-select home/Main studio when city data loads or city changes
  useEffect(() => {
    if (!selectedCity || !cities[selectedCity]) return;
    const studios = cities[selectedCity].studios || {};
    const entries = Object.entries(studios).filter(([, s]) => s && s.name);
    // If current selection is valid, keep it
    if (selectedStudio && studios[selectedStudio]?.name) return;
    const homeEntry = entries.find(([, s]) => (s as any).homeStudio);
    const mainEntry = entries.find(([, s]) => s.name?.toLowerCase() === 'main');
    const auto = homeEntry || mainEntry || entries[0];
    if (auto) setSelectedStudio(auto[0]);
  }, [selectedCity, cities]);

  const displayName: string = userRecord?.displayName || user.displayName || user.email || user.uid || 'Unknown User';

  const role = userRecord?.role;
  const assignedCities = userRecord?.assignedCities || [];
  const hasFullAdmin = isFullAdmin(role);
  const hasAnyAdmin = isAnyAdmin(role);

  const pendingCount = useMemo(() => {
    return Object.values(users).filter(u => {
      if (u.status !== 'pending') return false;
      if (hasFullAdmin) return true;
      if (role === 'City Admin') {
        return assignedCities.some(ck => u.requestedCity === ck || (u.assignedCities || []).includes(ck));
      }
      return false;
    }).length;
  }, [users, hasFullAdmin, role, assignedCities]);

  const cityList = useMemo(() => {
    const all = Object.entries(cities).map(([key, city]) => ({ key, name: city.name }));
    if (canSeeAllCities(role)) return all;
    if (!assignedCities.length) return all;
    return all.filter(c => assignedCities.includes(c.key));
  }, [cities, role, assignedCities]);

  const studioList = useMemo(() => {
    if (!selectedCity || !cities[selectedCity]) return [];
    return Object.entries(cities[selectedCity].studios || {}).map(([key, studio]) => ({ key, name: studio.name }));
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
    const sn = selectedStudioName();
    if (!sn) return allItems;
    return allItems.filter(item => (item.studioLocation ?? '').trim().toLowerCase() === sn.trim().toLowerCase());
  }, [inventory, selectedCity, selectedStudio, cities]);

  const logEntries = useMemo(() =>
    Object.entries(logs || {}).map(([key, log]) => ({ key, ...log }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  [logs]);

  const handleSignOut = async () => { try { await signOut(auth); } catch (e) { console.error(e); } };
  const handleCityChange = (cityKey: string) => {
    setSelectedCity(cityKey || null);
    // Auto-select: prefer homeStudio, fall back to 'main', then first studio
    if (cityKey && cities[cityKey]) {
      const studios = cities[cityKey].studios || {};
      const entries = Object.entries(studios).filter(([, s]) => s && s.name);
      const homeEntry = entries.find(([, s]) => (s as any).homeStudio);
      const mainEntry = entries.find(([, s]) => s.name?.toLowerCase() === 'main');
      const auto = homeEntry || mainEntry || entries[0];
      setSelectedStudio(auto ? auto[0] : null);
    } else {
      setSelectedStudio(null);
    }
  };

  const isCityView = activeView !== 'gp-lookup' && activeView !== 'admin';

  const cityTabs: { id: ActiveView; label: string; icon: React.ElementType }[] = [
    { id: 'inventory',     label: 'Inventory',     icon: Package        },
    { id: 'operations',   label: 'Operations',    icon: Wrench         },
    { id: 'loaners',      label: 'Loaners',       icon: Repeat         },
    { id: 'import-export',label: 'Import/Export', icon: ArrowLeftRight  },
    { id: 'analytics',    label: 'Analytics',     icon: BarChart3      },
    { id: 'size-guide',   label: 'Size Guide',    icon: Ruler          },
  ];

  const roleInfo = role ? roleMeta[role as keyof typeof roleMeta] : null;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div className="header-brand">
            <img src={logoUrl} alt="Uniform Manager" className="header-logo" />
            <h1>Uniform Manager</h1>
          </div>
          <div className="user-info">
            <span className="user-email">{user.email}</span>
            {roleInfo && (
              <span className="user-role-badge" style={{ background: `${roleInfo.color}22`, color: roleInfo.color, borderColor: `${roleInfo.color}44` }}>
                {roleInfo.label}
              </span>
            )}
            <button onClick={handleSignOut} className="btn btn-secondary">Sign Out</button>
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        <aside className="sidebar">
          <div className="selector-section">
            <h3>Select Location</h3>
            {citiesLoading ? <p>Loading cities...</p> : cityList.length === 0 ? (
              <p className="empty-message">No cities available for your account.</p>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="city-select">City</label>
                  <select id="city-select" value={selectedCity || ''} onChange={e => handleCityChange(e.target.value)} className="select-input">
                    <option value="">Select a city...</option>
                    {cityList.map(city => <option key={city.key} value={city.key}>{city.name}</option>)}
                  </select>
                </div>
                {selectedCity && !laundryEnabled && (
                  <div className="laundry-off-banner">🚫 Laundry disabled — returns go directly to Available</div>
                )}
                {selectedCity && (
                  <div className="form-group">
                    <label htmlFor="studio-select">Studio</label>
                    <select id="studio-select" value={selectedStudio || ''} onChange={e => setSelectedStudio(e.target.value || null)} className="select-input">
                      <option value="">— All Studios —</option>
                      {studioList.map(studio => <option key={studio.key} value={studio.key}>{studio.name}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="sidebar-nav">
            <button className={`sidebar-nav-btn ${activeView === 'gp-lookup' ? 'active' : ''}`} onClick={() => setActiveView('gp-lookup')}>
              <Search size={15} /> GP Lookup
            </button>
            {hasAnyAdmin && (
              <button className={`sidebar-nav-btn ${activeView === 'admin' ? 'active' : ''}`} onClick={() => setActiveView('admin')}>
                <Settings size={15} /> Admin
                {pendingCount > 0 && <span className="sidebar-badge">{pendingCount}</span>}
              </button>
            )}
          </div>
        </aside>

        <main className="main-content">
          {activeView === 'gp-lookup' && (
            <GPLookup gps={gps} allAssignments={allAssignments} cities={cities}
              cityKey={selectedCity || undefined} onBack={() => setActiveView('inventory')} />
          )}

          {activeView === 'admin' && hasAnyAdmin && (
            <AdminPanel users={users} cities={cities} currentUserRole={role} currentUserCities={assignedCities} />
          )}

          {isCityView && (
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
                      cityKey={selectedCity} cityName={cities[selectedCity].name}
                      studioKey={selectedStudio} studioName={selectedStudioInfo.name}
                      hamperCapacity={selectedStudioInfo.hamperCapacity}
                      currentHamperCount={selectedStudioInfo.currentHamperCount}
                    />
                  )}

                  <div className="view-tabs card">
                    <div className="tabs modern-tabs">
                      {cityTabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeView === tab.id;
                        return (
                          <button key={tab.id} className={`tab modern-tab ${isActive ? 'active' : ''}`}
                            onClick={() => setActiveView(tab.id)} aria-pressed={isActive} type="button" title={tab.label}>
                            <Icon size={18} strokeWidth={2} />
                            <span>{tab.label}</span>
                            {isActive && <div className="tab-underline" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {activeView === 'inventory' && (
                    <>
                      <section className="inventory-section">
                        <h2>Inventory{!inventoryLoading && (
                          <span style={{ fontSize: '0.875rem', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '0.75rem' }}>
                            ({inventoryItems.length} items{selectedStudioName() ? ` · ${selectedStudioName()}` : ` · ${cities[selectedCity]?.name}`})
                          </span>
                        )}</h2>
                        {inventoryLoading ? <p>Loading inventory...</p> : inventoryItems.length === 0 ? (
                          <p className="empty-message">No inventory items found{selectedStudioName() ? ` for studio "${selectedStudioName()}"` : ''}.</p>
                        ) : (
                          <div className="table-container">
                            <table className="data-table">
                              <thead><tr><th>Name</th><th>Size</th><th>Barcode</th><th>Status</th><th>Studio</th></tr></thead>
                              <tbody>
                                {inventoryItems.map(item => (
                                  <tr key={item.key}>
                                    <td>{item.name}</td><td>{item.size}</td>
                                    <td><code className="barcode">{item.barcode}</code></td>
                                    <td><span className={`status-badge status-${(item.status ?? '').toLowerCase().replace(/\s+/g, '-')}`}>{item.status}</span></td>
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
                        {logsLoading ? <p>Loading logs...</p> : logEntries.length === 0 ? (
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
                    <Operations cityKey={selectedCity} cityName={cities[selectedCity].name}
                      studioKey={selectedStudio || ''} studioName={selectedStudioInfo?.name || ''}
                      inventory={inventory} gps={gps} studios={cities[selectedCity].studios || {}}
                      laundryEnabled={laundryEnabled} onRefresh={() => {}} currentUser={displayName} />
                  )}

                  {activeView === 'loaners' && (
                    <ActiveLoaners assignments={assignments} inventory={inventory} studioName={selectedStudioInfo?.name} cityKey={selectedCity} cityName={cities[selectedCity]?.name} laundryEnabled={laundryEnabled} currentUser={displayName} />
                  )}

                  {activeView === 'import-export' && (
                    <ImportExport cityKey={selectedCity} cityName={cities[selectedCity].name}
                      studioKey={selectedStudio || ''} studioName={selectedStudioInfo?.name || ''}
                      inventory={inventory} assignments={assignments} laundryOrders={laundryOrders}
                      logs={logs} gamePresenters={gps} currentUser={displayName} />
                  )}

                  {activeView === 'analytics' && (
                    <Analytics cityKey={selectedCity} cityName={cities[selectedCity].name}
                      studioKey={selectedStudio || ''} studioName={selectedStudioInfo?.name || ''}
                      inventory={inventory} assignments={assignments} currentUser={displayName} />
                  )}

                  {activeView === 'size-guide' && (
                    <SizeSuggestion gps={gps} allAssignments={allAssignments} inventory={inventory} />
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
