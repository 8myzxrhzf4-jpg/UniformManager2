/*
  src/components/InventoryList.tsx
  Add a short delayed fallback to initialize from window.__lastFetchedInventory
  so timing/HMR won't leave the Inventory empty.
*/
import React, { useEffect, useState } from 'react';
import { fetchInventoryForCity } from '../services/inventoryService';
import type { UniformItem } from '../types';
import { getSelectedCityKey, getSelectedStudio } from '../state/citySelector';

function matchesStudio(item: UniformItem, selectedStudio: string | null) {
  if (!selectedStudio) return true;
  if (!item.studioLocation) return false;
  return item.studioLocation.trim().toLowerCase() === selectedStudio.trim().toLowerCase();
}

export default function InventoryList() {
  const [items, setItems] = useState<Array<UniformItem & { id: string }>>([]);
  const cityKey = getSelectedCityKey();
  const selectedStudio = getSelectedStudio();

  async function load() {
    console.log('[InventoryList] load() start', { cityKey, selectedStudio });
    if (!cityKey) {
      setItems([]);
      return;
    }

    try {
      const adapter = (window as any).__firebaseAdapter;
      if (adapter && typeof adapter.restGet === 'function') {
        console.log('[InventoryList] using adapter.restGet for', `inventory/${cityKey}`);
        const val = await adapter.restGet(`inventory/${cityKey}`);
        const all = Object.entries(val || {}).map(([id, data]) => ({ id, ...(data as any) })) as Array<UniformItem & { id: string }>;
        console.log('[InventoryList] adapter.restGet fetched total', all.length);
        const filtered = all.filter(i => matchesStudio(i as UniformItem, selectedStudio || null));
        console.log('[InventoryList] after studio filter', { total: all.length, filtered: filtered.length });
        (window as any).__lastFetchedInventory = filtered;
        setItems(filtered);
        console.log('[InventoryList] setItems called (adapter)');
        return;
      }

      console.log('[InventoryList] using fetchInventoryForCity for', cityKey);
      const all = await fetchInventoryForCity(cityKey);
      console.log('[InventoryList] fetchInventoryForCity fetched total', all.length);
      const filtered = all.filter(i => matchesStudio(i as UniformItem, selectedStudio || null));
      (window as any).__lastFetchedInventory = filtered;
      console.log('[InventoryList] after studio filter', { total: all.length, filtered: filtered.length });
      setItems(filtered);
      console.log('[InventoryList] setItems called (service)');
    } catch (err) {
      console.error('[InventoryList] Inventory fetch failed', err);
      setItems([]);
    }
  }

  useEffect(() => {
    // If a previous fetch placed items on window (timing/HMR), use them immediately.
    if ((window as any).__lastFetchedInventory && Array.isArray((window as any).__lastFetchedInventory)) {
      console.log('[InventoryList] initializing from window.__lastFetchedInventory', (window as any).__lastFetchedInventory.length);
      setItems((window as any).__lastFetchedInventory);
    }

    load();
    // small delayed fallback: if after a short delay there are still no items but
    // window.__lastFetchedInventory is present, use it (covers race/HMR cases).
    const fallback = setTimeout(() => {
      const w = (window as any).__lastFetchedInventory;
      if ((!items || items.length === 0) && w && Array.isArray(w) && w.length > 0) {
        console.log('[InventoryList] delayed fallback using window.__lastFetchedInventory', w.length);
        setItems(w);
      }
    }, 200);

    function onUpdated() { load(); }
    window.addEventListener('inventory-updated', onUpdated);
    return () => {
      clearTimeout(fallback);
      window.removeEventListener('inventory-updated', onUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityKey, selectedStudio]);

  if (!items || items.length === 0) return <div>No inventory items found for this location.</div>;

  return (
    <div>
      {items.map(it => (
        <div key={it.id}>
          <strong>{it.name}</strong> — {it.size} — {it.barcode} — {it.status}
        </div>
      ))}
    </div>
  );
}
