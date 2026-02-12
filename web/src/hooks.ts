import { useEffect, useState } from 'react';
import { ref, onValue, off, query, limitToLast } from 'firebase/database';
import { db } from './firebaseClient';
import type { City, GamePresenter, UniformItem, Assignment, LaundryOrder, LogEntry } from './types';

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
        setCities(data || {});
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
 * Hook to subscribe to game presenters data
 */
export function useGamePresenters() {
  const [presenters, setPresenters] = useState<Record<string, GamePresenter>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const gpsRef = ref(db, 'gps');
    
    onValue(
      gpsRef,
      (snapshot) => {
        const data = snapshot.val();
        setPresenters(data || {});
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
  }, []);

  return { presenters, loading, error };
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

    const inventoryRef = ref(db, `inventory/${cityName}`);
    
    onValue(
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

    return () => {
      off(inventoryRef);
    };
  }, [cityName]);

  return { inventory, loading, error };
}

/**
 * Hook to subscribe to assignments data for a specific city
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
    
    onValue(
      assignmentsRef,
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
 * Hook to subscribe to laundry orders data for a specific city
 */
export function useLaundryOrders(cityName: string | null) {
  const [orders, setOrders] = useState<Record<string, LaundryOrder>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!cityName) {
      setOrders({});
      setLoading(false);
      return;
    }

    const ordersRef = ref(db, `laundry_orders/${cityName}`);
    
    onValue(
      ordersRef,
      (snapshot) => {
        const data = snapshot.val();
        setOrders(data || {});
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

  return { orders, loading, error };
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
