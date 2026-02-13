/*
  web/src/components/InventoryList.tsx
  Use fetchInventoryForCity and normalized studio comparison.
  Replace getSelectedCityKey / getSelectedStudio with your app's selectors.
*/
import React, { useEffect, useState } from 'react';
import { fetchInventoryForCity } from '../services/inventoryService';
import type { UniformItem } from '../types';
import { getSelectedCityKey, getSelectedStudio } from '../state/citySelector'; // adapt to your selectors

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
    if (!cityKey) {
      setItems([]);
      return;
    }
    try {
      const all = await fetchInventoryForCity(cityKey);
      const filtered = all.filter(i => matchesStudio(i as UniformItem, selectedStudio || null));
      setItems(filtered);
    } catch (err) {
      console.error('Inventory fetch failed', err);
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    function onUpdated() { load(); }
    window.addEventListener('inventory-updated', onUpdated);
    return () => window.removeEventListener('inventory-updated', onUpdated);
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
