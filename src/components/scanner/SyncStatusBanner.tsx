import { useInventory } from '@/context/InventoryContext';
import { WifiOff, RefreshCw, Archive } from 'lucide-react';
import { useEffect, useState } from 'react';

export const SyncStatusBanner = () => {
  const { pendingSyncCount, isSyncing } = useInventory();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && pendingSyncCount === 0 && !isSyncing) {
    return null; // Hidden when everything is perfect
  }

  return (
    <div className="w-full mb-4">
      {/* Offline warning banner */}
      {!isOnline && (
        <div className="flex items-center justify-center bg-yellow-500 text-white px-4 py-2 text-sm font-medium rounded-md shadow-sm">
          <WifiOff className="w-4 h-4 mr-2" />
          You are offline. Scans are being saved locally and will sync automatically.
        </div>
      )}

      {/* Syncing progress banner */}
      {isSyncing && (
        <div className="flex items-center justify-center bg-blue-500 text-white px-4 py-2 text-sm font-medium rounded-md shadow-sm mt-2">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          Syncing {pendingSyncCount} offline scans to server...
        </div>
      )}

      {/* Pending scans badge (waiting for connection) */}
      {!isSyncing && pendingSyncCount > 0 && isOnline && (
        <div className="flex items-center justify-center bg-orange-500 text-white px-4 py-2 text-sm font-medium rounded-md shadow-sm mt-2">
          <Archive className="w-4 h-4 mr-2" />
          {pendingSyncCount} scans queued — waiting for strong connection to sync...
        </div>
      )}
    </div>
  );
};