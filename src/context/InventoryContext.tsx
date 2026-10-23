import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useRef
} from "react";
import SupabaseDataService from "@/services/SupabaseDataService";
import { useCompany } from "@/context/CompanyContext";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import SyncService from '@/services/SyncService';
import { offlineDB } from '@/services/OfflineDB';
import { toast } from "sonner";

export interface AuditorEntry {
  auditorId: string;
  auditorName: string;
  quantityFound: number;
  auditedAt: string;
  subLocation?: string;
  batchKey?: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name?: string;
  category?: string;
  location: string;
  companyId?: string;
  systemQuantity: number;
  physicalQuantity?: number;
  status?: "pending" | "matched" | "discrepancy";
  lastAudited?: string;
  notes?: string;
  auditorEntries?: AuditorEntry[];
  uploadBatchKey?: string;
  clientRemarks?: string;
  assignmentId?: number;
  customAttributes?: Record<string, any>;
}

export interface DashboardSummary {
  totalCount: number;
  matched: number;
  discrepancy: number;
  pending: number;
  valueVariance: number;
  hasPricing: boolean;
  categories: { category: string; matched: number; discrepancy: number }[];
}

export type AuditStatus = "pending" | "active" | "submitted" | "finalized";

export interface Location {
  id: string;
  name: string;
  description?: string;
  active?: boolean;
  companyId?: string;
  auditStatus?: AuditStatus;
}

export interface Assignment {
  id: number;
  locationId: string;
  companyId: string;
  status: AuditStatus;
  scheduledDate: string;
  auditorId?: string;
  auditorIds?: string[];
  clientIds?: string[];
  showSystemQuantity?: boolean;
}

export type QuestionType = "text" | "single_select" | "multi_select" | "yes_no" | "file";

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: QuestionOption[];
  companyId?: string;
}

export interface QuestionnaireAnswer {
  questionId: string;
  locationId: string;
  answer: string | string[];
  answeredBy?: string;
  answeredOn: string;
  companyId?: string;
  assignmentId?: number;
}

interface InventoryContextType {
  itemMaster: InventoryItem[];
  closingStock: InventoryItem[];
  auditedItems: InventoryItem[];
  locations: Location[];
  questions: Question[];
  assignments: Assignment[];
  questionnaireAnswers: QuestionnaireAnswer[];
  closingStockUploaded: boolean;
  selectedLocationFilter: string;
  activeSubLocations: string[];

  pendingSyncCount: number;
  isSyncing: boolean;

  /** Server-computed dashboard numbers (null until loaded / if the SQL function isn't installed). */
  dashboardSummary: DashboardSummary | null;
  /** True only while the very first item download for a company/assignment is running. */
  isLoading: boolean;
  /** Bumps when rows are added/removed/reloaded (NOT on every scan) - use as a cheap memo key. */
  itemsVersion: number;
  /** O(1) lookup by SKU + location name; returns the live (optimistically updated) row. */
  findItem: (sku: string, locationName: string) => InventoryItem | undefined;

  setSelectedLocationFilter: (locationId: string) => void;
  setItemMaster: (
    items: Omit<InventoryItem, "id">[],
    companyId: string | null
  ) => Promise<void>;
  setClosingStock: (
    items: Partial<InventoryItem>[],
    companyId: string | null,
    assignmentId: string
  ) => Promise<void>;
  updateAuditedItem: (
    item: InventoryItem,
    auditorId?: string,
    auditorName?: string,
    subLocation?: string
  ) => Promise<void>;
  updateItemRemark: (itemId: string, remark: string) => Promise<void>;
  updateLocationAuditStatus: (locationId: string, status: AuditStatus) => Promise<void>;

  createAssignment: (locationId: string, companyId: string, status: AuditStatus, date?: string, auditorIds?: string[], clientIds?: string[], showSystemQuantity?: boolean) => Promise<void>;
  updateAssignment: (id: number, status: AuditStatus, date?: string, auditorIds?: string[], clientIds?: string[], showSystemQuantity?: boolean) => Promise<void>;

  deleteAssignment: (id: number) => Promise<void>;

  submitAudit: (assignmentId: number) => Promise<void>;
  sendFinalizationOtp: (assignmentId: number) => Promise<string>;
  finalizeAudit: (assignmentId: number, otp: string) => Promise<void>;

  getInventorySummary: () => {
    totalItems: number;
    auditedItems: number;
    pendingItems: number;
    matched: number;
    discrepancies: number;
  };
  getLocationSummary: (location: string) => {
    totalItems: number;
    auditedItems: number;
    pendingItems: number;
    matched: number;
    discrepancies: number;
  };
  clearAllData: () => Promise<void>;
  addLocation: (location: Omit<Location, "id">) => Promise<void>;
  updateLocation: (location: Location) => Promise<void>;
  deleteLocation: (locationId: string) => Promise<void>;
  scanItem: (barcode: string, location: string) => Promise<void>;
  searchItem: (query: string) => InventoryItem[];

  addItemToAudit: (
    item: InventoryItem,
    quantity: number,
    auditorId?: string,
    auditorName?: string,
    subLocation?: string
  ) => Promise<number>;

  addSurplusItem: (
    item: { sku: string; name: string; category: string; physicalQuantity: number; subLocation?: string; customAttributes?: Record<string, any> }
  ) => Promise<void>;

  addBulkSurplusItems: (
    items: { sku: string; name: string; category: string; physicalQuantity: number; subLocation?: string; customAttributes?: Record<string, any> }[],
    batchKey: string
  ) => Promise<void>;

  uploadPhysicalQuantityStock: (
    items: any[],
    batchKey: string,
    approvedNewSkus?: Set<string>
  ) => Promise<void>;

  deleteItems: (itemIds: string[]) => Promise<void>;

  fetchGlobalItem: (sku: string) => Promise<any | null>;

  addQuestion: (question: Omit<Question, "id">) => Promise<void>;
  updateQuestion: (question: Question) => Promise<void>;
  deleteQuestion: (questionId: string) => Promise<void>;
  saveQuestionnaireAnswer: (
    answer: Omit<QuestionnaireAnswer, "answeredOn">
  ) => Promise<void>;
  getLocationQuestionnaireAnswers: (locationId: string) => QuestionnaireAnswer[];
  getAssignmentQuestionnaireAnswers: (assignmentId: number) => QuestionnaireAnswer[];
  getQuestionsForLocation: (locationId: string) => Question[];
  getQuestionById: (questionId: string) => Question | undefined;

  uploadFile: (file: File, path: string) => Promise<string>;

  fetchSubLocations: (locationId: string, query?: string) => Promise<void>;
  addSubLocationToDb: (name: string, locationId: string) => Promise<void>;

  refreshData: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

// Lightweight context for components that only need locations/assignments
// (e.g. permission checks). It does NOT change on every scan, so those
// components (ProtectedRoute, sidebar, ...) no longer re-render per scan.
const InventoryMetaContext = createContext<{ locations: Location[]; assignments: Assignment[] } | undefined>(undefined);

export const useInventoryMeta = () => {
  const context = useContext(InventoryMetaContext);
  if (context === undefined) throw new Error("useInventoryMeta must be used within an InventoryProvider");
  return context;
};

// Scans are applied to the in-memory list immediately but pushed to React in
// small batches, so a burst of scans costs one render instead of one per scan.
const SCAN_FLUSH_MS = 150;
// More realtime events than this in one batch (e.g. someone uploaded a CSV)
// => do one debounced reload instead of fetching rows one batch at a time.
const BULK_EVENT_THRESHOLD = 40;
// After a scan finishes saving, wait a moment, then re-read the authoritative
// row(s) in a single batched request.
const RECONCILE_DEBOUNCE_MS = 1200;
// Ignore realtime echoes of our own scans for this long (the reconcile above
// already covers them).
const OWN_ECHO_WINDOW_MS = 4000;

const skuLocKey = (sku: string, location: string) => `${sku}\u0000${location}`;

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // itemMaster and auditedItems were two identical copies of the same 15k-row
  // array, both rebuilt on every scan. They are now ONE array (auditedItems is
  // exposed as an alias of itemMaster).
  const [itemMaster, setItems] = useState<InventoryItem[]>([]);
  const [itemsVersion, setItemsVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [closingStockUploaded, setClosingStockUploaded] = useState(false);
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>("all");
  const [activeSubLocations, setActiveSubLocations] = useState<string[]>([]);

  const [dashboardStats, setDashboardStats] = useState({
    totalItems: 0, auditedItems: 0, pendingItems: 0, matched: 0, discrepancies: 0
  });

  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);

  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const { currentUser, user } = useUser();
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<QuestionnaireAnswer[]>([]);
  const { selectedCompanyId, selectedAssignmentId } = useCompany();

  // Latest company/assignment, readable from timers and listeners without
  // stale closures.
  const scopeRef = useRef<{ companyId: string | null; assignmentId: number | null }>({ companyId: null, assignmentId: null });
  scopeRef.current = {
    companyId: selectedCompanyId,
    assignmentId: selectedAssignmentId ? parseInt(String(selectedAssignmentId), 10) : null,
  };

  // ───────────────────────── item store ─────────────────────────
  // itemsRef is the source of truth. React state is a (slightly delayed) copy
  // of it. id / sku+location indexes make lookups O(1) instead of scanning
  // 15,000 rows with .find() on every scan.
  const itemsRef = useRef<InventoryItem[]>([]);
  const idIndexRef = useRef<Map<string, number>>(new Map());
  const skuLocIndexRef = useRef<Map<string, number>>(new Map());
  const pendingPatchesRef = useRef<Map<string, InventoryItem>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheDirtyRef = useRef(false);

  const rebuildIndex = (arr: InventoryItem[]) => {
    const byId = new Map<string, number>();
    const bySkuLoc = new Map<string, number>();
    for (let i = 0; i < arr.length; i++) {
      const it = arr[i];
      byId.set(it.id, i);
      const k = skuLocKey(it.sku, it.location);
      if (!bySkuLoc.has(k)) bySkuLoc.set(k, i);
    }
    idIndexRef.current = byId;
    skuLocIndexRef.current = bySkuLoc;
  };

  /** Fold any staged scan patches into itemsRef (no React render). */
  const mergePatches = (): InventoryItem[] => {
    const patches = pendingPatchesRef.current;
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
    if (patches.size === 0) return itemsRef.current;
    const next = itemsRef.current.slice();
    patches.forEach((item, id) => {
      const idx = idIndexRef.current.get(id);
      if (idx !== undefined) next[idx] = item;
    });
    patches.clear();
    itemsRef.current = next;
    return next;
  };

  /** Push staged scan patches to React (one render for any number of scans). */
  const flushPatches = () => {
    flushTimerRef.current = null;
    if (pendingPatchesRef.current.size === 0) return;
    const next = mergePatches();
    cacheDirtyRef.current = true;
    setItems(next);
  };

  const stagePatch = (item: InventoryItem) => {
    pendingPatchesRef.current.set(item.id, item);
    if (!flushTimerRef.current) flushTimerRef.current = setTimeout(flushPatches, SCAN_FLUSH_MS);
  };

  /** Replace the list (load / rows added / rows removed). */
  const commitStructural = (next: InventoryItem[]) => {
    pendingPatchesRef.current.clear();
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
    itemsRef.current = next;
    rebuildIndex(next);
    cacheDirtyRef.current = true;
    setItems(next);
    setItemsVersion((v) => v + 1);
  };

  const getLatestItem = (id: string): InventoryItem | undefined => {
    const patched = pendingPatchesRef.current.get(id);
    if (patched) return patched;
    const idx = idIndexRef.current.get(id);
    return idx === undefined ? undefined : itemsRef.current[idx];
  };

  const findItem = (sku: string, locationName: string): InventoryItem | undefined => {
    const idx = skuLocIndexRef.current.get(skuLocKey(sku, locationName));
    if (idx === undefined) return undefined;
    const base = itemsRef.current[idx];
    return base ? getLatestItem(base.id) : undefined;
  };

  /** Insert-or-replace rows coming from the server. */
  const upsertItems = (fresh: InventoryItem[]) => {
    if (fresh.length === 0) return;
    const cur = mergePatches();
    const next = cur.slice();
    let structural = false;
    for (const f of fresh) {
      const idx = idIndexRef.current.get(f.id);
      if (idx === undefined) {
        next.push(f);
        structural = true;
      } else {
        const old = next[idx];
        if (old.sku !== f.sku || old.location !== f.location) structural = true;
        next[idx] = f;
      }
    }
    if (structural) {
      commitStructural(next);
    } else {
      itemsRef.current = next;
      cacheDirtyRef.current = true;
      setItems(next);
    }
  };

  const removeItemsByIds = (ids: Set<string>) => {
    const cur = mergePatches();
    const next = cur.filter((i) => !ids.has(i.id));
    if (next.length !== cur.length) commitStructural(next);
  };

  // ───────────────────────── offline cache ─────────────────────────
  // Previously the whole inventory was written to IndexedDB (structured clone
  // of 15k rows on the main thread) after every change, and every write
  // INSERTED another copy. Now: one row per assignment, written only after a
  // load, when going offline / hiding the tab, and every few minutes if dirty.
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistCache = async (assignmentId?: number | null) => {
    const aid = assignmentId ?? scopeRef.current.assignmentId;
    if (!aid || !cacheDirtyRef.current || itemsRef.current.length === 0) return;
    cacheDirtyRef.current = false;
    try {
      await offlineDB.inventoryCache.put({
        assignmentId: aid,
        items: mergePatches(),
        cachedAt: new Date().toISOString(),
      });
    } catch (error) {
      cacheDirtyRef.current = true;
      console.warn('Failed to cache inventory locally:', error);
    }
  };

  useEffect(() => {
    const persist = () => { persistCache(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') persist(); };
    window.addEventListener('offline', persist);
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = setInterval(persist, 3 * 60 * 1000);
    return () => {
      window.removeEventListener('offline', persist);
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, []);

  // ───────────────────────── stats ─────────────────────────
  const statsRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshStatsDebounced = () => {
    if (statsRefreshTimer.current) clearTimeout(statsRefreshTimer.current);
    statsRefreshTimer.current = setTimeout(async () => {
      const { companyId, assignmentId } = scopeRef.current;
      if (companyId && assignmentId) {
        const [stats, summary] = await Promise.all([
          SupabaseDataService.getInventoryStats(companyId, assignmentId),
          SupabaseDataService.getDashboardSummary(companyId, assignmentId),
        ]);
        if (scopeRef.current.assignmentId !== assignmentId) return;
        if (stats) setDashboardStats(stats);
        if (summary) setDashboardSummary(summary);
      }
    }, 2000);
  };

  const applyPendingScansToItems = async (items: InventoryItem[]) => {
    try {
      const pending = await offlineDB.pendingScans.where('synced').equals(0).toArray();
      if (pending.length === 0) return items;

      // Group once (O(n + p)) instead of filtering the pending list per item.
      const byItem = new Map<string, typeof pending>();
      for (const p of pending) {
        const list = byItem.get(p.itemId);
        if (list) list.push(p); else byItem.set(p.itemId, [p]);
      }

      return items.map(item => {
        const itemPendingScans = byItem.get(item.id);
        if (!itemPendingScans) return item;

        const totalPendingQty = itemPendingScans.reduce((sum, p) => sum + p.quantityAdded, 0);
        const newQty = (item.physicalQuantity || 0) + totalPendingQty;

        const entries = [...(item.auditorEntries || [])];
        itemPendingScans.forEach(p => {
          if (p.newEntry) entries.push(p.newEntry);
        });

        return {
          ...item,
          physicalQuantity: Math.max(0, newQty),
          status: newQty === item.systemQuantity ? 'matched' : 'discrepancy',
          auditorEntries: entries,
          lastAudited: itemPendingScans[itemPendingScans.length - 1].attemptedAt
        } as InventoryItem;
      });
    } catch (err) {
      console.error("Error applying pending scans:", err);
      return items;
    }
  };

  // ───────────────────────── full load ─────────────────────────
  const loadSeq = useRef(0);
  const lastLoadStartedAtRef = useRef(0);
  const loadRetryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadDataRef = useRef<() => Promise<void>>(async () => { });

  const loadData = async () => {
    if (!selectedCompanyId) return;
    // Only the most recent load may write state; older, slower responses
    // (e.g. from a previous assignment or an overlapping realtime reload)
    // are discarded so they can't overwrite fresh data with stale/empty data.
    const mySeq = ++loadSeq.current;
    const isStale = () => mySeq !== loadSeq.current;
    lastLoadStartedAtRef.current = Date.now();
    // Only show the loading state for the first load, not for background refreshes.
    if (itemsRef.current.length === 0) setIsLoading(true);

    try {
      const assignmentIdParam = selectedAssignmentId ? parseInt(String(selectedAssignmentId), 10) : null;

      // Everything below is independent, so run it concurrently instead of
      // one-after-another (was ~8 sequential round trips + the item download).
      const statsP = (async () => {
        if (assignmentIdParam) {
          // both aggregates run in parallel on the server
          const [stats, summary] = await Promise.all([
            SupabaseDataService.getInventoryStats(selectedCompanyId, assignmentIdParam),
            SupabaseDataService.getDashboardSummary(selectedCompanyId, assignmentIdParam),
          ]);
          if (isStale()) return;
          if (stats) setDashboardStats(stats);
          setDashboardSummary(summary ?? null);
        } else if (!isStale()) {
          setDashboardStats({ totalItems: 0, auditedItems: 0, pendingItems: 0, matched: 0, discrepancies: 0 });
          setDashboardSummary(null);
        }
      })();

      const itemsP = (async () => {
        try {
          const dbItems = await SupabaseDataService.getItemMaster(selectedCompanyId, assignmentIdParam);
          const adjustedItems = await applyPendingScansToItems(dbItems);
          if (isStale()) return;
          commitStructural(adjustedItems); // fresh server data supersedes optimistic values
          loadRetryRef.current = 0;
          if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
          persistTimerRef.current = setTimeout(() => { persistCache(assignmentIdParam); }, 2500);
        } catch (networkError) {
          console.warn('Item fetch failed, loading from local cache...', networkError);
          let usedCache = false;
          if (assignmentIdParam) {
            try {
              const cached = await offlineDB.inventoryCache.get(assignmentIdParam);
              if (cached && !isStale()) {
                const adjustedItems = await applyPendingScansToItems(cached.items);
                commitStructural(adjustedItems);
                cacheDirtyRef.current = false;
                usedCache = true;
              }
            } catch (cacheErr) {
              console.warn('Local cache read failed', cacheErr);
            }
          }
          // Never leave the user with an empty dashboard because of a transient
          // failure: tell them and retry in the background.
          if (!isStale() && navigator.onLine && loadRetryRef.current < 3) {
            loadRetryRef.current += 1;
            if (!usedCache) toast.error("Couldn't load inventory — retrying…");
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            retryTimerRef.current = setTimeout(() => { loadDataRef.current(); }, 3000 * loadRetryRef.current);
          } else if (!usedCache && !isStale()) {
            toast.error("Could not load inventory. Check your connection and refresh.");
          }
        }
      })();

      const metaP = Promise.all([
        SupabaseDataService.getAssignments(selectedCompanyId).then(a => { if (!isStale()) setAssignments(a); }),
        SupabaseDataService.getLocations().then(locs => { if (!isStale()) setLocations(locs.filter((l) => l.companyId === selectedCompanyId)); }),
        (selectedAssignmentId
          ? SupabaseDataService.hasClosingStockForAssignment(Number(selectedAssignmentId))
          : Promise.resolve(false)
        ).then(v => { if (!isStale()) setClosingStockUploaded(v); }),
        SupabaseDataService.getQuestions(selectedCompanyId).then(qs => {
          if (isStale()) return;
          setQuestions((qs || []).map((q: any) => ({
            id: q.id, text: q.text, type: q.type, required: q.required, options: q.options || [], companyId: q.company_id ?? selectedCompanyId,
          })));
        }),
        SupabaseDataService.getQuestionnaireAnswers(selectedCompanyId).then(a => { if (!isStale()) setQuestionnaireAnswers(a || []); }),
      ]);

      await Promise.all([statsP, itemsP, metaP]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      if (!isStale()) setIsLoading(false);
    }
  };
  loadDataRef.current = loadData;

  const runSync = async () => {
    if (!navigator.onLine) return;
    const count = await SyncService.getPendingCount();
    if (count === 0) return;

    setIsSyncing(true);
    setPendingSyncCount(count);

    await SyncService.syncPendingScans((synced, total) => {
      setPendingSyncCount(total - synced);
    });

    setIsSyncing(false);
    setPendingSyncCount(0);
    toast.success("Offline scans synced to server successfully!");

    await loadDataRef.current();
  };

  useEffect(() => {
    window.addEventListener('online', runSync);
    return () => window.removeEventListener('online', runSync);
  }, []);

  useEffect(() => {
    // New company / assignment => drop the previous scope's rows right away
    // (never show or scan against another assignment's data).
    loadRetryRef.current = 0;
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (itemsRef.current.length > 0) {
      commitStructural([]);
      cacheDirtyRef.current = false;
    }

    const init = async () => {
      await loadDataRef.current();
      if (navigator.onLine) {
        await runSync();
      } else {
        const count = await SyncService.getPendingCount();
        setPendingSyncCount(count);
      }
    };
    init();

    const oldAssignmentId = selectedAssignmentId ? parseInt(String(selectedAssignmentId), 10) : null;
    return () => {
      // Save the outgoing assignment's rows before they are replaced.
      persistCache(oldAssignmentId);
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [selectedCompanyId, selectedAssignmentId]);

  // ───────────────────────── live sync helpers ─────────────────────────
  // item id -> number of scan RPCs still in flight for that item
  const inflightByIdRef = useRef<Map<string, number>>(new Map());
  // item id -> last time WE scanned it (to ignore the realtime echo of our own write)
  const recentLocalScansRef = useRef<Map<string, number>>(new Map());
  const reconcileIdsRef = useRef<Set<string>>(new Set());
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Re-read rows from the server (ONE batched request) and merge them in. */
  const fetchAndApplyByIds = async (ids: string[]) => {
    const scope = scopeRef.current;
    if (!scope.companyId) return;
    const targets = ids.filter((id) => !((inflightByIdRef.current.get(id) || 0) > 0));
    if (targets.length === 0) return;
    try {
      const rows = await SupabaseDataService.getItemsByIds(targets);
      const now = scopeRef.current;
      if (now.companyId !== scope.companyId || now.assignmentId !== scope.assignmentId) return;

      const fresh = rows.filter((r) =>
        String(r.companyId) === String(scope.companyId) &&
        String(r.assignmentId ?? "") === String(scope.assignmentId ?? "") &&
        // a new local scan may have started while we were fetching
        !((inflightByIdRef.current.get(r.id) || 0) > 0)
      );
      if (fresh.length === 0) return;
      fresh.forEach((r) => pendingPatchesRef.current.delete(r.id));
      upsertItems(fresh);
      refreshStatsDebounced();
    } catch (err) {
      console.error("Live sync fetch failed:", err);
    }
  };

  const queueReconcile = (id: string) => {
    reconcileIdsRef.current.add(id);
    if (reconcileTimerRef.current) return;
    reconcileTimerRef.current = setTimeout(() => {
      reconcileTimerRef.current = null;
      const ids = Array.from(reconcileIdsRef.current);
      reconcileIdsRef.current.clear();
      fetchAndApplyByIds(ids);
    }, RECONCILE_DEBOUNCE_MS);
  };

  // 🔥 PERFORMANCE FIX: realtime
  //  - subscription is filtered on the server (assignment_id / company_id), so a
  //    15k-row upload in ANOTHER company no longer streams 15k events to everyone
  //  - events are batched; small batches are fetched with ONE `in (...)` query
  //  - big bursts (CSV upload) trigger a single, jittered reload instead of
  //    every connected user hammering the database at the same instant
  //  - our own scans are not re-fetched on every echo
  useEffect(() => {
    if (!selectedCompanyId) return;

    const companyId = selectedCompanyId;
    const scopeAssignment = selectedAssignmentId ? parseInt(String(selectedAssignmentId), 10) : null;
    const filter = scopeAssignment ? `assignment_id=eq.${scopeAssignment}` : `company_id=eq.${companyId}`;
    const channelName = `live-dashboard-${companyId}-${scopeAssignment ?? 'global'}`;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    const pendingUpserts = new Set<string>();
    const pendingDeletes = new Set<string>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    let lastEventAt = 0;
    let bulkUntil = 0;
    let disposed = false;

    const scheduleBulkReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      // spread simultaneous reloads from many users over a few seconds
      const delay = 2500 + Math.random() * 2500;
      reloadTimer = setTimeout(async () => {
        reloadTimer = null;
        if (disposed) return;
        // a load that started after the last event already contains the change
        if (lastLoadStartedAtRef.current >= lastEventAt) return;
        await loadDataRef.current();
        refreshStatsDebounced();
      }, delay);
    };

    const flush = async () => {
      flushTimer = null;
      if (disposed) return;

      if (pendingDeletes.size > 0) {
        removeItemsByIds(new Set(pendingDeletes));
        pendingDeletes.clear();
        refreshStatsDebounced();
      }
      if (pendingUpserts.size === 0) return;

      if (pendingUpserts.size > BULK_EVENT_THRESHOLD || Date.now() < bulkUntil) {
        pendingUpserts.clear();
        bulkUntil = Date.now() + 6000;
        scheduleBulkReload();
        return;
      }
      const ids = Array.from(pendingUpserts);
      pendingUpserts.clear();
      await fetchAndApplyByIds(ids);
    };

    const connectRealtime = () => {
      if (!navigator.onLine || channel) return;

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'inventory_items', filter },
          (payload) => {
            lastEventAt = Date.now();

            if (payload.eventType === 'DELETE') {
              // DELETE events can't be filtered server-side; the id lookup makes this a no-op for foreign rows.
              const id = (payload.old as any)?.id;
              if (id && idIndexRef.current.has(id)) pendingDeletes.add(id);
            } else {
              const row = payload.new as any;
              if (!row?.id) return;
              if (String(row.company_id) !== String(companyId)) return;
              if (String(row.assignment_id ?? "") !== String(scopeAssignment ?? "")) return;

              const ownScanAt = recentLocalScansRef.current.get(row.id);
              if (ownScanAt && Date.now() - ownScanAt < OWN_ECHO_WINDOW_MS) return;

              pendingUpserts.add(row.id);
            }

            // Throttle (not debounce): flush at most every 300ms while events stream in
            if (!flushTimer) flushTimer = setTimeout(flush, 300);
          }
        )
        .subscribe();
    };

    const disconnectRealtime = () => {
      if (channel) { supabase.removeChannel(channel); channel = null; }
    };

    connectRealtime();
    window.addEventListener('online', connectRealtime);
    window.addEventListener('offline', disconnectRealtime);

    return () => {
      disposed = true;
      if (flushTimer) clearTimeout(flushTimer);
      if (reloadTimer) clearTimeout(reloadTimer);
      window.removeEventListener('online', connectRealtime);
      window.removeEventListener('offline', disconnectRealtime);
      disconnectRealtime();
    };
  }, [selectedCompanyId, selectedAssignmentId]);

  const setItemMaster = async (items: Omit<InventoryItem, "id">[], companyId: string | null) => {
    if (!companyId) throw new Error("No company selected.");
    await SupabaseDataService.setItemMaster(items.map((item) => ({ ...item, auditorEntries: [] })), companyId);
    await loadData();
  };

  const setClosingStock = async (items: Partial<InventoryItem>[], companyId: string | null, assignmentId: string): Promise<void> => {
    if (!companyId || !assignmentId || itemMaster.length === 0) return;
    const finalItemsToUpsert: Partial<InventoryItem>[] = [];
    const masterMap = new Map<string, InventoryItem>();
    itemMaster.forEach((item) => { masterMap.set(item.sku, item); });

    for (const stockItem of items) {
      const metadataSource = masterMap.get(stockItem.sku as string);
      finalItemsToUpsert.push({
        sku: stockItem.sku,
        name: metadataSource?.name || stockItem.name || "Unnamed Item",
        category: metadataSource?.category || stockItem.category || "",
        location: stockItem.location as string,
        systemQuantity: Number(stockItem.systemQuantity) || 0,
        physicalQuantity: 0,
        status: "pending",
        auditorEntries: [],
        companyId: companyId,
        uploadBatchKey: stockItem.uploadBatchKey,
        assignmentId: parseInt(assignmentId),
        customAttributes: metadataSource?.customAttributes || {}
      });
    }
    await SupabaseDataService.setClosingStock(finalItemsToUpsert, companyId, assignmentId);
    await loadData();
  };

  const updateAuditedItem = async (item: InventoryItem) => {
    if (!item.id) throw new Error("Item ID required");
    await SupabaseDataService.updateItemAttributes(item.id, item.customAttributes || {}, item.clientRemarks);
    const freshItem = await SupabaseDataService.getSingleItem(item.id);
    if (freshItem) {
      pendingPatchesRef.current.delete(freshItem.id);
      upsertItems([freshItem]);
    }
  };

  const updateItemRemark = async (itemId: string, remark: string) => {
    const existing = getLatestItem(itemId);
    if (existing) stagePatch({ ...existing, clientRemarks: remark });
    await SupabaseDataService.updateItemRemark(itemId, remark);
  };

  const updateLocationAuditStatus = async (locationId: string, status: AuditStatus) => {
    setLocations(prev => prev.map(loc => loc.id === locationId ? { ...loc, auditStatus: status } : loc));
    await SupabaseDataService.updateLocationAuditStatus(locationId, status);
  };

  const createAssignment = async (locationId: string, companyId: string, status: AuditStatus, date?: string, auditorIds?: string[], clientIds?: string[], showSystemQuantity?: boolean) => {
    const newAssignment = await SupabaseDataService.createAssignment({
      locationId, companyId, status, scheduledDate: date || new Date().toISOString(), auditorIds, clientIds, showSystemQuantity
    });
    setAssignments(prev => [newAssignment, ...prev]);
    if (status === 'active' || status === 'pending') await updateLocationAuditStatus(locationId, 'active');
  };

  const updateAssignment = async (id: number, status: AuditStatus, date?: string, auditorIds?: string[], clientIds?: string[], showSystemQuantity?: boolean) => {
    await SupabaseDataService.updateAssignment(id, { status, scheduledDate: date, auditorIds, clientIds, showSystemQuantity });
    setAssignments(prev => prev.map(a => a.id === id ? {
      ...a, status, scheduledDate: date || a.scheduledDate, auditorIds: auditorIds || a.auditorIds, clientIds: clientIds || a.clientIds, showSystemQuantity: showSystemQuantity !== undefined ? showSystemQuantity : a.showSystemQuantity
    } : a));
  };

  const deleteAssignment = async (id: number) => {
    await SupabaseDataService.deleteAssignment(id);
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const submitAudit = async (assignmentId: number) => {
    await updateAssignment(assignmentId, "submitted");
    const assignment = assignments.find(a => a.id === assignmentId);
    if (assignment) await updateLocationAuditStatus(assignment.locationId, "submitted");
    await loadData();
  };

  const sendFinalizationOtp = async (assignmentId: number) => await SupabaseDataService.sendAssignmentOtp(assignmentId);

  const finalizeAudit = async (assignmentId: number, otp: string) => {
    if (!selectedCompanyId) throw new Error("No company selected");
    const isValid = await SupabaseDataService.verifyAssignmentOtp(assignmentId, otp);
    if (!isValid) throw new Error("Invalid Verification Code");

    await updateAssignment(assignmentId, "finalized");
    await loadData();
  };

  const addLocation = async (location: Omit<Location, "id">) => {
    if (!selectedCompanyId) return;
    await SupabaseDataService.addLocation({ ...location, companyId: selectedCompanyId });
    await loadData();
  };

  const updateLocation = async (location: Location) => {
    await SupabaseDataService.updateLocation(location);
    await loadData();
  };

  const deleteLocation = async (locationId: string) => {
    await SupabaseDataService.deleteLocation(locationId);
    await loadData();
  };

  const scanItem = async (barcode: string, locationName: string) => {
    const item = findItem(barcode, locationName) ?? (() => {
      const byId = getLatestItem(barcode);
      return byId && byId.location === locationName ? byId : undefined;
    })();
    if (!item) throw new Error(`Item not found`);
    const activeName = currentUser?.email || currentUser?.name || user?.email || "Unknown Auditor";
    await addItemToAudit(item, 1, currentUser?.id || user?.id, activeName, undefined);
  };

  const searchItem = (query: string) => {
    if (!query || query.length < 2) return [];
    const lowerCaseQuery = query.toLowerCase();
    return itemMaster.filter(item => item.id?.toLowerCase().includes(lowerCaseQuery) || item.sku?.toLowerCase().includes(lowerCaseQuery) || item.name?.toLowerCase().includes(lowerCaseQuery) || item.category?.toLowerCase().includes(lowerCaseQuery));
  };

  const addItemToAudit = async (item: InventoryItem, quantity: number, auditorId?: string, auditorName?: string, subLocation?: string): Promise<number> => {
    if (quantity === 0) return item.physicalQuantity || 0;

    // O(1) lookups against the live store (includes not-yet-rendered scans),
    // instead of two linear .find() passes over every item.
    const masterItem = getLatestItem(item.id) ?? findItem(item.sku, item.location);
    if (!masterItem?.id) throw new Error("Item ID missing - cannot record scan");
    const baseQty = masterItem.physicalQuantity || 0;

    // 🔥 FIX: Deductions safely validate against live memory
    if (quantity < 0) {
      const isAllowedAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
      if (!isAllowedAdmin) throw new Error("Only administrators can decrease audited quantities.");
      if (baseQty + quantity < 0) throw new Error("Cannot decrease total physical quantity below zero.");
    }

    const activeUserId = currentUser?.id || user?.id || auditorId || "unknown";
    const activeUserName = currentUser?.email || currentUser?.name || user?.email || auditorName || "Unknown Auditor";

    const newEntry = {
      clientScanId: crypto.randomUUID(), // Fix 2.2: unique id for idempotency
      auditorId: activeUserId,
      auditorName: activeUserName,
      quantityFound: quantity,
      auditedAt: new Date().toISOString(),
      subLocation: subLocation || "General"
    };

    // ⚡ Optimistic update: applied to the live store immediately (so back-to-back
    // scans of the same item stack correctly) and pushed to React in a batch.
    const optimisticQuantity = Math.max(0, baseQty + quantity);
    stagePatch({
      ...masterItem,
      physicalQuantity: optimisticQuantity,
      lastAudited: newEntry.auditedAt,
      status: optimisticQuantity === masterItem.systemQuantity ? 'matched' : 'discrepancy',
      auditorEntries: [...(masterItem.auditorEntries || []), newEntry],
    });

    const itemId = masterItem.id;
    inflightByIdRef.current.set(itemId, (inflightByIdRef.current.get(itemId) || 0) + 1);
    recentLocalScansRef.current.set(itemId, Date.now());

    // Persist in the background. SyncService.recordScan falls back to the
    // offline queue on any network failure, so the scan is never lost.
    (async () => {
      let savedOnline = false;
      let failed = false;
      try {
        const mode = await SyncService.recordScan(itemId, newEntry, quantity);
        if (mode === 'offline') {
          setPendingSyncCount(await SyncService.getPendingCount());
        } else {
          savedOnline = true;
          refreshStatsDebounced();
        }
      } catch (error: any) {
        failed = true;
        console.error("Scan recording failed:", error);
        toast.error(`Scan may not have saved: ${error.message}`);
      } finally {
        const left = (inflightByIdRef.current.get(itemId) || 1) - 1;
        if (left <= 0) inflightByIdRef.current.delete(itemId);
        else inflightByIdRef.current.set(itemId, left);
        recentLocalScansRef.current.set(itemId, Date.now());
        // Once the last in-flight scan for this item has settled, re-read the
        // authoritative row (batched with other items) — also reverts the
        // optimistic value if the save failed.
        if (left <= 0 && (savedOnline || failed)) queueReconcile(itemId);
      }
    })();

    return optimisticQuantity;
  };


  const addSurplusItem = async (item: { sku: string; name: string; category: string; physicalQuantity: number; subLocation?: string; customAttributes?: Record<string, any> }) => {
    if (!selectedCompanyId || !selectedAssignmentId) throw new Error("No active assignment selected.");
    const assignment = assignments.find(a => String(a.id) === String(selectedAssignmentId));
    if (!assignment) throw new Error("Assignment not found.");
    const loc = locations.find(l => l.id === assignment.locationId);
    if (!loc) throw new Error("Location not found.");

    const activeUserId = currentUser?.id || user?.id;
    const activeUserName = currentUser?.email || currentUser?.name || user?.email || "Unknown Auditor";

    await SupabaseDataService.addSurplusItem({ item, companyId: selectedCompanyId, assignmentId: Number(selectedAssignmentId), locationName: loc.name, userId: activeUserId, userName: activeUserName });
    await loadData();
  };

  const addBulkSurplusItems = async (items: { sku: string; name: string; category: string; physicalQuantity: number; subLocation?: string; customAttributes?: Record<string, any> }[], batchKey: string) => {
    if (!selectedCompanyId || !selectedAssignmentId) throw new Error("No active assignment selected.");
    const assignment = assignments.find(a => String(a.id) === String(selectedAssignmentId));
    if (!assignment) throw new Error("Assignment not found.");
    const loc = locations.find(l => l.id === assignment.locationId);
    if (!loc) throw new Error("Location not found.");

    const activeUserId = currentUser?.id || user?.id;
    const activeUserName = currentUser?.email || currentUser?.name || user?.email || "Unknown Auditor";

    await SupabaseDataService.addBulkSurplusItems({
      items,
      companyId: selectedCompanyId,
      assignmentId: Number(selectedAssignmentId),
      locationName: loc.name,
      batchKey: batchKey,
      userId: activeUserId,
      userName: activeUserName
    });
    await loadData();
  };

  const uploadPhysicalQuantityStock = async (items: any[], batchKey: string, approvedNewSkus?: Set<string>) => {
    if (!selectedCompanyId || !selectedAssignmentId) throw new Error("No active assignment selected.");

    const activeUserId = currentUser?.id || user?.id;
    const activeUserName = currentUser?.email || currentUser?.name || user?.email || "System Upload";

    await SupabaseDataService.uploadPhysicalQuantityStock({
      items,
      companyId: selectedCompanyId,
      assignmentId: Number(selectedAssignmentId),
      batchKey,
      userId: activeUserId || 'unknown',
      userName: activeUserName,
      approvedNewSkus,
    });
    await loadData();
  };

  const deleteItems = async (itemIds: string[]) => {
    if (!selectedCompanyId) throw new Error("No active company.");

    await SupabaseDataService.deleteInventoryItems(itemIds);

    removeItemsByIds(new Set(itemIds));

    toast.success(`${itemIds.length} item(s) deleted successfully.`);
    refreshStatsDebounced();
  };

  const fetchGlobalItem = async (sku: string) => selectedCompanyId ? await SupabaseDataService.getGlobalMasterItem(selectedCompanyId, sku) : null;
  const getInventorySummary = () => dashboardStats;
  const getLocationSummary = () => dashboardStats;
  const addQuestion = async (question: Omit<Question, "id">) => { if (!selectedCompanyId) return; await SupabaseDataService.addQuestion({ ...question, companyId: selectedCompanyId }); await loadData(); };
  const updateQuestion = async (question: Question) => { await SupabaseDataService.updateQuestion(question); await loadData(); };
  const deleteQuestion = async (questionId: string) => { await SupabaseDataService.deleteQuestion(questionId); setQuestions((prev) => prev.filter((q) => q.id !== questionId)); };

  const saveQuestionnaireAnswer = async (answer: Omit<QuestionnaireAnswer, "answeredOn">) => {
    const activeUserName = currentUser?.email || currentUser?.name || user?.email || "Unknown";

    const newAnswer: QuestionnaireAnswer = { ...answer, answeredOn: new Date().toISOString(), answeredBy: activeUserName, companyId: locations.find(loc => loc.id === answer.locationId)?.companyId };
    setQuestionnaireAnswers((prev) => {
      const existingIndex = prev.findIndex((a) => a.questionId === answer.questionId && a.assignmentId === answer.assignmentId);
      if (existingIndex !== -1) { const updated = [...prev]; updated[existingIndex] = newAnswer; return updated; }
      return [...prev, newAnswer];
    });
    await SupabaseDataService.upsertQuestionnaireAnswer(newAnswer);
  };

  const getLocationQuestionnaireAnswers = (locationId: string) => questionnaireAnswers.filter((answer) => answer.locationId === locationId);
  const getAssignmentQuestionnaireAnswers = (assignmentId: number) => questionnaireAnswers.filter((answer) => answer.assignmentId === assignmentId);
  const getQuestionsForLocation = (locationId: string) => { const cId = locations.find((l) => l.id === locationId)?.companyId ?? selectedCompanyId; return questions.filter((q) => !q.companyId || q.companyId === cId); };
  const getQuestionById = (questionId: string) => questions.find((q) => q.id === questionId);
  const clearAllData = async () => { if (!selectedCompanyId) return; await SupabaseDataService.clearInventoryData(selectedCompanyId); commitStructural([]); setQuestionnaireAnswers([]); setAssignments([]); };
  const uploadFile = async (file: File, path: string) => await SupabaseDataService.uploadFile(file, path);
  const fetchSubLocations = async (locationId: string, query?: string) => setActiveSubLocations(locationId ? await SupabaseDataService.getSubLocations(locationId, query) : []);

  const addSubLocationToDb = async (name: string, locationId: string) => {
    if (!selectedCompanyId) return;
    setActiveSubLocations(prev => prev.includes(name) ? prev : [...prev, name].sort());
    try { await SupabaseDataService.createSubLocation({ name, locationId, companyId: selectedCompanyId }); } catch (e) { setActiveSubLocations(prev => prev.filter(s => s !== name)); }
  };

  const value = useMemo<InventoryContextType>(() => ({
    itemMaster, closingStock: itemMaster.filter(i => i.status === 'pending'), auditedItems: itemMaster, assignments, locations, questions, questionnaireAnswers, closingStockUploaded, selectedLocationFilter, activeSubLocations, pendingSyncCount, isSyncing, dashboardSummary, isLoading, itemsVersion, findItem, setSelectedLocationFilter, setItemMaster, setClosingStock, updateAuditedItem, updateItemRemark, updateLocationAuditStatus, getInventorySummary, getLocationSummary, clearAllData, addLocation, updateLocation, deleteLocation, scanItem, searchItem, addItemToAudit, addSurplusItem, addBulkSurplusItems, uploadPhysicalQuantityStock, deleteItems, addQuestion, updateQuestion, deleteQuestion, saveQuestionnaireAnswer, getLocationQuestionnaireAnswers, getAssignmentQuestionnaireAnswers, getQuestionsForLocation, getQuestionById, createAssignment, updateAssignment, deleteAssignment, submitAudit, sendFinalizationOtp, finalizeAudit, refreshData: loadData, uploadFile, fetchSubLocations, addSubLocationToDb, fetchGlobalItem
    // Functions are re-created every render but only read the state listed here,
    // so the context value only changes when one of these actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [itemMaster, itemsVersion, isLoading, assignments, locations, questions, questionnaireAnswers, closingStockUploaded, selectedLocationFilter, activeSubLocations, pendingSyncCount, isSyncing, dashboardStats, dashboardSummary, selectedCompanyId, selectedAssignmentId, currentUser, user]);

  const metaValue = useMemo(() => ({ locations, assignments }), [locations, assignments]);

  return (
    <InventoryMetaContext.Provider value={metaValue}>
      <InventoryContext.Provider value={value}>
        {children}
      </InventoryContext.Provider>
    </InventoryMetaContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) throw new Error("useInventory must be used within an InventoryProvider");
  return context;
};