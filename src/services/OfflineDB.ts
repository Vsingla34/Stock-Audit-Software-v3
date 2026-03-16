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
  id?: number;
  assignmentId: number;
  items: InventoryItem[];
  cachedAt: string;      
}

class OfflineDatabase extends Dexie {
  pendingScans!: Table<PendingScan>;
  cachedInventory!: Table<CachedInventory>;

  constructor() {
    super('AuditOfflineDB');
    // 🔥 FIX: Bumped version from 1 to 2 to automatically clear the old, broken boolean data out of your browser
    this.version(2).stores({
      pendingScans: '++id, itemId, synced',
      cachedInventory: '++id, assignmentId'
    });
  }
}

export const offlineDB = new OfflineDatabase();