/*
  web/src/services/inventoryService.ts
  Centralized inventory read/write helpers (Firebase Realtime Database).
  Adapt the firebase import to match your project structure if needed.
*/
import firebase from '../firebase'; // <-- adjust path if your firebase init is elsewhere
import type { UniformItem } from '../types';

export function inventoryPathForCity(cityKey: string) {
  return `inventory/${cityKey}`;
}

/**
 * Write multiple items to inventory under inventory/{cityKey}/{generatedId}
 * items: array of UniformItem (without id)
 */
export async function writeInventoryItems(cityKey: string, items: UniformItem[]) {
  const basePath = inventoryPathForCity(cityKey);
  const updates: Record<string, any> = {};
  const ref = firebase.database().ref('');

  items.forEach(item => {
    const newKey = ref.child(basePath).push().key!;
    const toWrite = {
      ...item,
      studioLocation: item.studioLocation ? String(item.studioLocation).trim() : ''
    };
    updates[`${basePath}/${newKey}`] = toWrite;
  });

  console.debug('Import: writing', items.length, 'items to', basePath);
  await ref.update(updates);
  console.debug('Import: write complete for', basePath);
  return Object.keys(updates).length;
}

/**
 * Fetch inventory items for a cityKey
 */
export async function fetchInventoryForCity(cityKey: string) {
  if (!cityKey) return [];
  const path = inventoryPathForCity(cityKey);
  const snap = await firebase.database().ref(path).once('value');
  const val = snap.val() || {};
  const items = Object.entries(val).map(([id, data]) => ({ id, ...(data as any) }));
  console.debug('Fetch inventory for', path, 'count=', items.length);
  return items as Array<UniformItem & { id: string }>;
}
