import React, {
  createContext,
  useContext,
  useState,
  useEffect,
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
  
  // 🔥 FIX: Added customAttributes to the addSurplusItem interface
  addItemToAudit: (
    item: InventoryItem,
    quantity: number,
    auditorId?: string,
    auditorName?: string,
    subLocation?: string
  ) => Promise<number>;
  
  addSurplusItem: (
    item: { sku: string; name: string; category: string; physicalQuantity: number; customAttributes?: Record<string, any> }
  ) => Promise<void>;

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

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [itemMaster, setItemMasterState] = useState<InventoryItem[]>([]);
  const [auditedItems, setAuditedItemsState] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [closingStockUploaded, setClosingStockUploaded] = useState(false); 
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>("all");
  const [activeSubLocations, setActiveSubLocations] = useState<string[]>([]);
  
  const [dashboardStats, setDashboardStats] = useState({
    totalItems: 0, auditedItems: 0, pendingItems: 0, matched: 0, discrepancies: 0
  });

  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const { currentUser, user } = useUser();   
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<QuestionnaireAnswer[]>([]);
  const { selectedCompanyId, selectedAssignmentId } = useCompany();
  const statsRefreshTimer = useRef<NodeJS.Timeout | null>(null);

  const refreshStatsDebounced = () => {
    if (statsRefreshTimer.current) clearTimeout(statsRefreshTimer.current);
    statsRefreshTimer.current = setTimeout(async () => {
      if (selectedCompanyId && selectedAssignmentId) {
        const stats = await SupabaseDataService.getInventoryStats(selectedCompanyId, parseInt(String(selectedAssignmentId)));
        if (stats) setDashboardStats(stats);
      }
    }, 2000); 
  };

  const applyPendingScansToItems = async (items: InventoryItem[]) => {
    try {
      const pending = await offlineDB.pendingScans.where('synced').equals(0).toArray();
      if (pending.length === 0) return items;

      return items.map(item => {
        const itemPendingScans = pending.filter(p => p.itemId === item.id);
        if (itemPendingScans.length === 0) return item;

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
        };
      });
    } catch (err) {
      console.error("Error applying pending scans:", err);
      return items;
    }
  };

  const loadData = async () => {
    if (!selectedCompanyId) return;
    
    try {
      const fetchedAssignments = await SupabaseDataService.getAssignments(selectedCompanyId);
      setAssignments(fetchedAssignments);
      
      const locs = await SupabaseDataService.getLocations();
      setLocations(locs.filter((l) => l.companyId === selectedCompanyId));

      const assignmentIdParam = selectedAssignmentId ? parseInt(String(selectedAssignmentId), 10) : null;
      if (assignmentIdParam) {
          const stats = await SupabaseDataService.getInventoryStats(selectedCompanyId, assignmentIdParam);
          if (stats) setDashboardStats(stats);
      } else {
          setDashboardStats({ totalItems: 0, auditedItems: 0, pendingItems: 0, matched: 0, discrepancies: 0 });
      }

      try {
        const dbItems = await SupabaseDataService.getItemMaster(selectedCompanyId, assignmentIdParam);
        const adjustedItems = await applyPendingScansToItems(dbItems);
        setItemMasterState(adjustedItems);
        setAuditedItemsState(adjustedItems);
      } catch (networkError) {
        console.warn('Network unavailable, loading from local cache...');
        if (assignmentIdParam) {
          const cached = await offlineDB.cachedInventory.where('assignmentId').equals(assignmentIdParam).first();
          if (cached) {
            const adjustedItems = await applyPendingScansToItems(cached.items);
            setItemMasterState(adjustedItems);
            setAuditedItemsState(adjustedItems);
          }
        }
      }

      if (selectedAssignmentId) {
        setClosingStockUploaded(await SupabaseDataService.hasClosingStockForAssignment(selectedAssignmentId));
      } else {
        setClosingStockUploaded(false);
      }

      const qs = await SupabaseDataService.getQuestions(selectedCompanyId);
      setQuestions((qs || []).map((q: any) => ({
        id: q.id, text: q.text, type: q.type, required: q.required, options: q.options || [], companyId: q.company_id ?? selectedCompanyId,
      })));

      const answers = await SupabaseDataService.getQuestionnaireAnswers(selectedCompanyId);
      setQuestionnaireAnswers(answers || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

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
    
    await loadData();
  };

  useEffect(() => {
    window.addEventListener('online', runSync);
    return () => window.removeEventListener('online', runSync);
  }, []); 

  useEffect(() => {
    const init = async () => {
      await loadData();
      if (navigator.onLine) {
        await runSync();
      } else {
        const count = await SyncService.getPendingCount();
        setPendingSyncCount(count);
      }
    };
    init();
  }, [selectedCompanyId, selectedAssignmentId]);

  useEffect(() => {
    if (!selectedCompanyId) return; 

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const connectRealtime = () => {
      if (!navigator.onLine) return; 

      const filterString = selectedAssignmentId 
        ? `assignment_id=eq.${selectedAssignmentId}`
        : `company_id=eq.${selectedCompanyId}`;

      channel = supabase
        .channel(`live-dashboard-${selectedAssignmentId || 'global'}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'inventory_items', filter: filterString },
          async (payload) => {
            if (payload.eventType === 'DELETE') return;
            try {
                const freshItem = await SupabaseDataService.getSingleItem(payload.new.id);
                setAuditedItemsState(prev => {
                  const idx = prev.findIndex(i => i.id === freshItem.id);
                  if (idx >= 0) { const newArr = [...prev]; newArr[idx] = freshItem; return newArr; }
                  return [...prev, freshItem];
                });
                setItemMasterState(prev => {
                  const idx = prev.findIndex(i => i.id === freshItem.id);
                  if (idx >= 0) { const newArr = [...prev]; newArr[idx] = freshItem; return newArr; }
                  return [...prev, freshItem];
                });
                refreshStatsDebounced();
            } catch (err) {
                console.error("Live sync fetch failed:", err);
            }
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
      window.removeEventListener('online', connectRealtime);
      window.removeEventListener('offline', disconnectRealtime);
      disconnectRealtime();
    };
  }, [selectedCompanyId, selectedAssignmentId]);

  useEffect(() => {
    if (!selectedAssignmentId || itemMaster.length === 0) return;
    const cacheInventory = async () => {
      try {
        await offlineDB.cachedInventory.put({
          assignmentId: Number(selectedAssignmentId),
          items: itemMaster,
          cachedAt: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Failed to cache inventory locally:', error);
      }
    };
    cacheInventory();
  }, [itemMaster, selectedAssignmentId]);

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
    setAuditedItemsState(prev => {
      const idx = prev.findIndex(i => i.id === freshItem.id);
      if (idx >= 0) { const newArr = [...prev]; newArr[idx] = freshItem; return newArr; }
      return [...prev, freshItem];
    });
  };

  const updateItemRemark = async (itemId: string, remark: string) => {
    setItemMasterState(prev => prev.map(i => i.id === itemId ? { ...i, clientRemarks: remark } : i));
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
    const item = itemMaster.find((i) => (i.id === barcode || i.sku === barcode) && i.location === locationName);
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
    
    if (quantity < 0) {
        const isAllowedAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
        if (!isAllowedAdmin) throw new Error("Only administrators can decrease audited quantities.");
        if ((item.physicalQuantity || 0) + quantity < 0) throw new Error("Cannot decrease total physical quantity below zero.");
    }

    const masterItem = itemMaster.find((i) => i.sku === item.sku && i.location === item.location);
    if (!masterItem?.id) throw new Error("Item ID missing - cannot record scan");
    
    const activeUserId = currentUser?.id || user?.id || auditorId || "unknown";
    const activeUserName = currentUser?.email || currentUser?.name || user?.email || auditorName || "Unknown Auditor";

    const newEntry = { 
      auditorId: activeUserId, 
      auditorName: activeUserName, 
      quantityFound: quantity, 
      auditedAt: new Date().toISOString(), 
      subLocation: subLocation || "General" 
    };

    try {
      const mode = await SyncService.recordScan(masterItem.id, newEntry, quantity);

      if (mode === 'offline') {
        const optimisticQuantity = Math.max(0, (item.physicalQuantity || 0) + quantity);

        setAuditedItemsState(prev => {
          const idx = prev.findIndex(i => i.id === masterItem.id);
          if (idx >= 0) {
            const newArr = [...prev];
            newArr[idx] = {
              ...newArr[idx],
              physicalQuantity: optimisticQuantity,
              lastAudited: new Date().toISOString(),
              status: optimisticQuantity === masterItem.systemQuantity ? 'matched' : 'discrepancy',
              auditorEntries: [...(newArr[idx].auditorEntries || []), newEntry]
            };
            return newArr;
          }
          return prev;
        });

        const pendingCount = await SyncService.getPendingCount();
        setPendingSyncCount(pendingCount);
        return optimisticQuantity;
      }

      const freshItem = await SupabaseDataService.getSingleItem(masterItem.id);
      setAuditedItemsState(prev => {
        const idx = prev.findIndex(i => i.id === freshItem.id);
        if (idx >= 0) { const newArr = [...prev]; newArr[idx] = freshItem; return newArr; }
        return [...prev, freshItem];
      });
      refreshStatsDebounced();
      return freshItem.physicalQuantity || 0;
    } catch (error: any) {
      console.error("Scan recording failed:", error);
      throw new Error(`Failed to record scan: ${error.message}`);
    } 
  };

  // 🔥 FIX: Updated implementation to accept customAttributes parameter 
  const addSurplusItem = async (item: { sku: string; name: string; category: string; physicalQuantity: number; customAttributes?: Record<string, any> }) => {
    if (!selectedCompanyId || !selectedAssignmentId) throw new Error("No active assignment selected.");
    const assignment = assignments.find(a => a.id === selectedAssignmentId);
    if (!assignment) throw new Error("Assignment not found.");
    const loc = locations.find(l => l.id === assignment.locationId);
    if (!loc) throw new Error("Location not found.");
    
    const activeUserId = currentUser?.id || user?.id;
    const activeUserName = currentUser?.email || currentUser?.name || user?.email || "Unknown Auditor";

    await SupabaseDataService.addSurplusItem({ item, companyId: selectedCompanyId, assignmentId: selectedAssignmentId, locationName: loc.name, userId: activeUserId, userName: activeUserName });
    await loadData();
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
  const clearAllData = async () => { if (!selectedCompanyId) return; await SupabaseDataService.clearInventoryData(selectedCompanyId); setItemMasterState([]); setAuditedItemsState([]); setQuestionnaireAnswers([]); setAssignments([]); };
  const uploadFile = async (file: File, path: string) => await SupabaseDataService.uploadFile(file, path);
  const fetchSubLocations = async (locationId: string, query?: string) => setActiveSubLocations(locationId ? await SupabaseDataService.getSubLocations(locationId, query) : []);
  
  const addSubLocationToDb = async (name: string, locationId: string) => {
      if (!selectedCompanyId) return;
      setActiveSubLocations(prev => prev.includes(name) ? prev : [...prev, name].sort());
      try { await SupabaseDataService.createSubLocation({ name, locationId, companyId: selectedCompanyId }); } catch (e) { setActiveSubLocations(prev => prev.filter(s => s !== name)); }
  };

  return (
    <InventoryContext.Provider
      value={{
        itemMaster, closingStock: itemMaster.filter(i => i.status === 'pending'), auditedItems, assignments, locations, questions, questionnaireAnswers, closingStockUploaded, selectedLocationFilter, activeSubLocations, pendingSyncCount, isSyncing, setSelectedLocationFilter, setItemMaster, setClosingStock, updateAuditedItem, updateItemRemark, updateLocationAuditStatus, getInventorySummary, getLocationSummary, clearAllData, addLocation, updateLocation, deleteLocation, scanItem, searchItem, addItemToAudit, addSurplusItem, addQuestion, updateQuestion, deleteQuestion, saveQuestionnaireAnswer, getLocationQuestionnaireAnswers, getAssignmentQuestionnaireAnswers, getQuestionsForLocation, getQuestionById, createAssignment, updateAssignment, deleteAssignment, submitAudit, sendFinalizationOtp, finalizeAudit, refreshData: loadData, uploadFile, fetchSubLocations, addSubLocationToDb, fetchGlobalItem
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) throw new Error("useInventory must be used within an InventoryProvider");
  return context;
};