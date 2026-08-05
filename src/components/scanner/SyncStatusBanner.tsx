import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  CloudOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import SyncService from "@/services/SyncService";
import { toastError } from "@/lib/handleError";
import { toast } from "sonner";
import { useInventory } from "@/context/InventoryContext";

type SyncState = "idle" | "syncing" | "success" | "error" | "offline";

interface BannerConfig {
  bg: string;
  border: string;
  iconColor: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
}

const CONFIGS: Record<SyncState, BannerConfig> = {
  idle: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    iconColor: "text-amber-500",
    icon: <CloudOff className="h-4 w-4" />,
    title: "Scans pending upload",
    description: "Your scans are saved locally and will be uploaded when ready.",
  },
  syncing: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    iconColor: "text-blue-500",
    icon: <RefreshCw className="h-4 w-4 animate-spin" />,
    title: "Syncing…",
    description: "Uploading your offline scans to the server.",
  },
  success: {
    bg: "bg-green-50",
    border: "border-green-200",
    iconColor: "text-green-500",
    icon: <CheckCircle2 className="h-4 w-4" />,
    title: "All scans uploaded",
  },
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    iconColor: "text-red-500",
    icon: <AlertTriangle className="h-4 w-4" />,
    title: "Sync failed",
    description: `Could not upload scans. Tap "Retry" to try again.`,
  },
  offline: {
    bg: "bg-gray-100",
    border: "border-gray-300",
    iconColor: "text-gray-500",
    icon: <WifiOff className="h-4 w-4" />,
    title: "You're offline",
    description: "Scans are saved locally and will upload when you reconnect.",
  },
};

/** How often (ms) to auto-sync while the user is online */
const AUTO_SYNC_INTERVAL_MS = 60_000;

/** How long (ms) to show the "success" state before hiding the banner */
const SUCCESS_HIDE_DELAY_MS = 4_000;

export const SyncStatusBanner = () => {
  const { refreshData } = useInventory();

  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [progress, setProgress] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const isSyncingRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── helpers ──────────────────────────────────────────────────────────────

  const refreshCount = useCallback(async () => {
    const count = await SyncService.getPendingCount();
    setPendingCount(count);
    return count;
  }, []);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // ─── core sync ────────────────────────────────────────────────────────────

  const runSync = useCallback(async () => {
    if (isSyncingRef.current || !navigator.onLine) return;

    const count = await refreshCount();
    if (count === 0) return;

    isSyncingRef.current = true;
    setSyncState("syncing");
    setProgress(0);

    try {
      await SyncService.syncPendingScans((synced, total) => {
        setProgress(Math.round((synced / total) * 100));
      });

      setLastSyncedAt(new Date());
      setSyncState("success");
      await refreshCount();

      // Refresh the inventory table so newly synced counts appear
      await refreshData();

      // Auto-hide the success banner after a few seconds
      hideTimerRef.current = setTimeout(() => {
        setSyncState("idle");
      }, SUCCESS_HIDE_DELAY_MS);
    } catch (err) {
      setSyncState("error");
      toastError(err, `Sync failed. Tap "Retry" to try again.`);
    } finally {
      isSyncingRef.current = false;
    }
  }, [refreshCount, refreshData]);

  // ─── lifecycle ────────────────────────────────────────────────────────────

  // Online / offline events
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      setSyncState("idle");
      runSync(); // auto-sync on reconnect
    };
    const onOffline = () => {
      setIsOnline(false);
      setSyncState("offline");
      if (autoSyncRef.current) clearInterval(autoSyncRef.current);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [runSync]);

  // Initial count load
  useEffect(() => {
    refreshCount();
    if (!navigator.onLine) setSyncState("offline");
  }, [refreshCount]);

  // Auto-sync every 60 s while online
  useEffect(() => {
    if (!isOnline) return;
    autoSyncRef.current = setInterval(runSync, AUTO_SYNC_INTERVAL_MS);
    return () => {
      if (autoSyncRef.current) clearInterval(autoSyncRef.current);
    };
  }, [isOnline, runSync]);

  // Cleanup hide timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // ─── visibility logic ─────────────────────────────────────────────────────

  const shouldShow =
    syncState === "offline" ||
    syncState === "syncing" ||
    syncState === "error" ||
    syncState === "success" ||
    (syncState === "idle" && pendingCount > 0);

  if (!shouldShow) return null;

  // ─── render ───────────────────────────────────────────────────────────────

  const config = CONFIGS[syncState];

  return (
    <div
      className={`
        w-full mb-4 rounded-lg border px-4 py-3
        flex items-start gap-3 transition-all duration-300
        ${config.bg} ${config.border}
      `}
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      <span className={`mt-0.5 shrink-0 ${config.iconColor}`}>
        {config.icon}
      </span>

      {/* Body */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800">{config.title}</p>

          {/* Pending badge */}
          {pendingCount > 0 && syncState !== "success" && (
            <span className="text-xs font-medium bg-white border border-current rounded-full px-2 py-0.5 text-gray-600">
              {pendingCount} scan{pendingCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Description */}
        {config.description && (
          <p className="text-xs text-gray-500">{config.description}</p>
        )}

        {/* Progress bar — only while syncing */}
        {syncState === "syncing" && (
          <div className="pt-1">
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-blue-500 mt-1">{progress}% complete</p>
          </div>
        )}

        {/* Last synced timestamp */}
        {lastSyncedAt && syncState !== "syncing" && (
          <p className="text-xs text-gray-400">
            Last synced at {formatTime(lastSyncedAt)}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="shrink-0 flex items-center gap-2">
        {/* Sync Now — idle with pending items and online */}
        {syncState === "idle" && isOnline && pendingCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 border-amber-300 text-amber-700 bg-white hover:bg-amber-100"
            onClick={runSync}
          >
            <Wifi className="h-3.5 w-3.5" />
            Sync Now
          </Button>
        )}

        {/* Retry — after a failed sync */}
        {syncState === "error" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 border-red-300 text-red-700 bg-white hover:bg-red-50"
            onClick={runSync}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
};