import { useState, useMemo } from 'react';
import { signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebaseClient';
import { useCities, useInventory, useLogs } from '../hooks';
import './Dashboard.css';

interface DashboardProps {
  user: User;
}

export function Dashboard({ user }: DashboardProps) {
  const { cities, loading: citiesLoading } = useCities();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedStudio, setSelectedStudio] = useState<string | null>(null);
  
  const { inventory, loading: inventoryLoading } = useInventory(selectedCity);
  const { logs, loading: logsLoading } = useLogs(selectedCity, selectedStudio);

  // Get list of cities
  const cityList = useMemo(() => {
    return Object.entries(cities).map(([key, city]) => ({
      key,
      name: city.name,
    }));
  }, [cities]);

  // Get list of studios for selected city
  const studioList = useMemo(() => {
    if (!selectedCity || !cities[selectedCity]) return [];
    const city = cities[selectedCity];
    return Object.entries(city.studios || {}).map(([key, studio]) => ({
      key,
      name: studio.name,
    }));
  }, [cities, selectedCity]);

  // Convert inventory object to array and filter by selected studio
  const inventoryItems = useMemo(() => {
    const items = Object.entries(inventory).map(([key, item]) => ({
      key,
      ...item,
    }));
    
    if (selectedStudio) {
      return items.filter(item => item.studioLocation === selectedStudio);
    }
    
    return items;
  }, [inventory, selectedStudio]);

  // Convert logs object to array and sort by date (most recent first)
  const logEntries = useMemo(() => {
    return Object.entries(logs)
      .map(([key, log]) => ({
        key,
        ...log,
      }))
      .sort((a, b) => {
        // Sort by date descending (most recent first)
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [logs]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleCityChange = (cityKey: string) => {
    setSelectedCity(cityKey);
    setSelectedStudio(null); // Reset studio when city changes
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Uniform Manager</h1>
          <div className="user-info">
            <span className="user-email">{user.email}</span>
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
              <p className="empty-message">No cities available. Add cities in Firebase.</p>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="city-select">City</label>
                  <select
                    id="city-select"
                    value={selectedCity || ''}
                    onChange={(e) => handleCityChange(e.target.value)}
                    className="select-input"
                  >
                    <option value="">Select a city...</option>
                    {cityList.map((city) => (
                      <option key={city.key} value={city.key}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCity && (
                  <div className="form-group">
                    <label htmlFor="studio-select">Studio</label>
                    <select
                      id="studio-select"
                      value={selectedStudio || ''}
                      onChange={(e) => setSelectedStudio(e.target.value)}
                      className="select-input"
                    >
                      <option value="">All Studios</option>
                      {studioList.map((studio) => (
                        <option key={studio.key} value={studio.key}>
                          {studio.name}
                        </option>
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
              <p>Select a city from the sidebar to view inventory and logs.</p>
            </div>
          ) : (
            <>
              <section className="inventory-section">
                <h2>Inventory</h2>
                {inventoryLoading ? (
                  <p>Loading inventory...</p>
                ) : inventoryItems.length === 0 ? (
                  <p className="empty-message">
                    No inventory items found for this location.
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
                          <th>Studio Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryItems.map((item) => (
                          <tr key={item.key}>
                            <td>{item.name}</td>
                            <td>{item.size}</td>
                            <td>
                              <code className="barcode">{item.barcode}</code>
                            </td>
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

              {selectedStudio && (
                <section className="logs-section">
                  <h2>Activity Logs</h2>
                  <p className="section-description">Last 100 entries, most recent first</p>
                  {logsLoading ? (
                    <p>Loading logs...</p>
                  ) : logEntries.length === 0 ? (
                    <p className="empty-message">No logs found for this location.</p>
                  ) : (
                    <div className="logs-list">
                      {logEntries.map((log) => (
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
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
