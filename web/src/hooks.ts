import { useEffect, useState } from 'react';
import { ref, onValue, off, query, limitToLast } from 'firebase/database';
import { db } from './firebase';
import type { City, UniformItem, LogEntry, Assignment, LaundryOrder, GamePresenter, WeeklyAuditList, AuditHistoryEntry } from './types';

/**
 * Hook to subscribe to cities data
 */
export function useCities() {
  const [cities, setCities] = useState<Record<string, City>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const citiesRef = ref(db, 'cities');
    
    onValue(
      citiesRef,
      (snapshot) => {
        const data = snapshot.val();
        const raw = data || {};
        Object.values(raw).forEach((city: any) => {
          if (Array.isArray(city.studios)) {
            const keyed: any = {};
            city.studios.forEach((s: any) => {
              const k = s.name.toLowerCase().replace(/\s+/g, "_");
              keyed[k] = s;
            });
            city.studios = keyed;
          }
        });
        setCities(raw);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      off(citiesRef);
    };
  }, []);

  return { cities, loading, error };
}

/**
 * Hook to subscribe to inventory data for a specific city
 */
export function useInventory(cityName: string | null) {
  const [inventory, setInventory] = useState<Record<string, UniformItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!cityName) {
      setInventory({});
      setLoading(false);
      return;
    }

    console.log("[hooks] useInventory cityName =", cityName);
    const inventoryRef = ref(db, `inventory/${cityName}`);
    
    const unsub = onValue(
      inventoryRef,
      (snapshot) => {
        const data = snapshot.val();
        setInventory(data || {});
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsub;
  }, [cityName]);

  return { inventory, loading, error };
}

/**
 * Hook to subscribe to logs for a specific city and studio
 * Limited to the last 100 entries
 */
export function useLogs(cityName: string | null, studioName: string | null) {
  const [logs, setLogs] = useState<Record<string, LogEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!cityName || !studioName) {
      setLogs({});
      setLoading(false);
      return;
    }

    const logsRef = ref(db, `logs/${cityName}/${studioName}`);
    const logsQuery = query(logsRef, limitToLast(100));
    
    onValue(
      logsQuery,
      (snapshot) => {
        const data = snapshot.val();
        setLogs(data || {});
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      off(logsRef);
    };
  }, [cityName, studioName]);

  return { logs, loading, error };
}

/**
 * Hook to subscribe to game presenters (GPs)
 */
export function useGamePresenters(cityName?: string | null) {
  const [gps, setGps] = useState<Record<string, GamePresenter>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const path = cityName ? `gamePresenters/${cityName}` : 'gamePresenters';
    const gpsRef = ref(db, path);
    
    onValue(
      gpsRef,
      (snapshot) => {
        const data = snapshot.val();
        setGps(data || {});
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      off(gpsRef);
    };
  }, [cityName]);

  return { gps, loading, error };
}

/**
 * Hook to subscribe to assignments for a specific city
 * Limited to the last 500 entries to optimize for Spark plan
 */
export function useAssignments(cityName: string | null) {
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!cityName) {
      setAssignments({});
      setLoading(false);
      return;
    }

    const assignmentsRef = ref(db, `assignments/${cityName}`);
    const assignmentsQuery = query(assignmentsRef, limitToLast(500));
    
    onValue(
      assignmentsQuery,
      (snapshot) => {
        const data = snapshot.val();
        setAssignments(data || {});
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      off(assignmentsRef);
    };
  }, [cityName]);

  return { assignments, loading, error };
}

/**
 * Hook to subscribe to laundry orders for a specific city
 * Limited to the last 200 entries to optimize for Spark plan
 */
export function useLaundryOrders(cityName: string | null) {
  const [laundryOrders, setLaundryOrders] = useState<Record<string, LaundryOrder>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!cityName) {
      setLaundryOrders({});
      setLoading(false);
      return;
    }

    const ordersRef = ref(db, `laundry_orders/${cityName}`);
    const ordersQuery = query(ordersRef, limitToLast(200));
    
    onValue(
      ordersQuery,
      (snapshot) => {
        const data = snapshot.val();
        setLaundryOrders(data || {});
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      off(ordersRef);
    };
  }, [cityName]);

  return { laundryOrders, loading, error };
}

/**
 * Hook to subscribe to weekly audit lists for a specific city and studio
 * Limited to the last 10 weeks to optimize for Spark plan
 */
export function useWeeklyAuditLists(cityName: string | null, studioName: string | null) {
  const [auditLists, setAuditLists] = useState<Record<string, WeeklyAuditList>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!cityName || !studioName) {
      setAuditLists({});
      setLoading(false);
      return;
    }

    const auditListsRef = ref(db, `audit_lists/${cityName}/${studioName}`);
    const auditListsQuery = query(auditListsRef, limitToLast(10));
    
    onValue(
      auditListsQuery,
      (snapshot) => {
        const data = snapshot.val();
        setAuditLists(data || {});
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      off(auditListsRef);
    };
  }, [cityName, studioName]);

  return { auditLists, loading, error };
}

/**
 * Hook to subscribe to audit history for a specific city and studio
 * Limited to the last 200 entries to optimize for Spark plan
 */
export function useAuditHistory(cityName: string | null, studioName: string | null) {
  const [auditHistory, setAuditHistory] = useState<Record<string, AuditHistoryEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!cityName || !studioName) {
      setAuditHistory({});
      setLoading(false);
      return;
    }

    const historyRef = ref(db, `audit_history/${cityName}/${studioName}`);
    const historyQuery = query(historyRef, limitToLast(200));
    
    onValue(
      historyQuery,
      (snapshot) => {
        const data = snapshot.val();
        setAuditHistory(data || {});
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      off(historyRef);
    };
  }, [cityName, studioName]);

  return { auditHistory, loading, error };
}
 
