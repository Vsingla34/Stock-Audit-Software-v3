import { offlineDB } from './OfflineDB';
import SupabaseDataService from './SupabaseDataService';

class SyncService {
  private isSyncing = false;

  public async recordScan(
    itemId: string,
    newEntry: any,
    quantityAdded: number
  ): Promise<'online' | 'offline'> {
    if (navigator.onLine) {
      try {
        await SupabaseDataService.secureRecordScan(itemId, newEntry, quantityAdded);
        return 'online';
      } catch (error) {
        console.warn('Network call failed despite navigator.onLine, queuing offline:', error);
        await this.queueScan(itemId, newEntry, quantityAdded);
        return 'offline';
      }
    } else {
      await this.queueScan(itemId, newEntry, quantityAdded);
      return 'offline';
    }
  }

  private async queueScan(
    itemId: string,
    newEntry: any,
    quantityAdded: number
  ): Promise<void> {
    await offlineDB.pendingScans.add({
      itemId,
      newEntry,
      quantityAdded,
      attemptedAt: new Date().toISOString(),
      synced: 0 // 🔥 FIX: Saved as 0 instead of 'false' so Dexie can find it!
    });
  }

  public async getPendingCount(): Promise<number> {
    return await offlineDB.pendingScans
      .where('synced').equals(0).count();
  }

  public async syncPendingScans(
    onProgress?: (synced: number, total: number) => void
  ): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const pending = await offlineDB.pendingScans
        .where('synced').equals(0)
        .sortBy('id');

      if (pending.length === 0) return;

      let syncedCount = 0;

      for (const scan of pending) {
        try {
          await SupabaseDataService.secureRecordScan(
            scan.itemId,
            scan.newEntry, 
            scan.quantityAdded
          );

          // 🔥 FIX: Updated as 1 instead of 'true'
          await offlineDB.pendingScans.update(scan.id!, { synced: 1 });

          syncedCount++;
          onProgress?.(syncedCount, pending.length);

        } catch (error) {
          console.error('Sync stopped at scan ID:', scan.id, error);
          break;
        }
      }

      // Clean up successfully synced records
      await offlineDB.pendingScans
        .where('synced').equals(1).delete();

    } finally {
      this.isSyncing = false;
    }
  }
}

export default new SyncService();