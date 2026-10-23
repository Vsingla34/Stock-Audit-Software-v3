import Dexie, { Table } from 'dexie';
import { InventoryItem } from '@/context/InventoryContext';

export interface PendingScan {
  id?: number;
  itemId: string;
  newEntry: any;
  quantityAdded: number;
  attemptedAt: string;
  synced: number;        // 🔥 FIX: Changed from boolean to number (0 or 1)
}

export interface CachedInventory {
  assignmentId: number;
  items: InventoryItem[];
  cachedAt: string;
}

class OfflineDatabase extends Dexie {
  pendingScans!: Table<PendingScan>;
  // Legacy table (auto-increment key => every put() INSERTED a new full copy of
  // the inventory). Kept only so Dexie can migrate it away in version 3.
  cachedInventory!: Table<any>;
  // One row per assignment (primary key = assignmentId), so put() overwrites.
  inventoryCache!: Table<CachedInventory, number>;

  constructor() {
    super('AuditOfflineDB');
    // 🔥 FIX: Bumped version from 1 to 2 to automatically clear the old, broken boolean data out of your browser
    this.version(2).stores({
      pendingScans: '++id, itemId, synced',
      cachedInventory: '++id, assignmentId'
    });
    // PERFORMANCE FIX: the old cache table grew by one full copy of the
    // inventory on every write (and .first() then returned the OLDEST copy).
    // Drop it and use a table keyed by assignmentId instead.
    this.version(3).stores({
      pendingScans: '++id, itemId, synced',
      cachedInventory: null,
      inventoryCache: 'assignmentId'
    });
  }
}

export const offlineDB = new OfflineDatabase();