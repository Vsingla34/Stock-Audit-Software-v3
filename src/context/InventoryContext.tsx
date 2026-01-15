import React, {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";
import SupabaseDataService from "@/services/SupabaseDataService";
import { useCompany } from "@/context/CompanyContext";
import { useUser } from "@/context/UserContext";

export interface AuditorEntry {
  auditorId: string;
  auditorName: string;
  quantityFound: number;
  auditedAt: string;
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
}

export type QuestionType = "text" | "single_select" | "multi_select" | "yes_no";

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
  selectedLocationFilter: string;
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
    auditorName?: string
  ) => Promise<void>;
  updateItemRemark: (itemId: string, remark: string) => Promise<void>;
  updateLocationAuditStatus: (locationId: string, status: AuditStatus) => Promise<void>;
  
  createAssignment: (locationId: string, companyId: string, status: AuditStatus, date?: string, auditorIds?: string[]) => Promise<void>; 
  updateAssignment: (id: number, status: AuditStatus, date?: string, auditorIds?: string[]) => Promise<void>;
  
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
  scanItem: (barcode: string, location: string) => void;
  searchItem: (query: string) => InventoryItem[];
  addItemToAudit: (
    item: InventoryItem,
    quantity: number,
    auditorId?: string,
    auditorName?: string
  ) => void;
  
  // New Surplus Function
  addSurplusItem: (
    item: { sku: string; name: string; category: string; physicalQuantity: number }
  ) => Promise<void>;

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
}

const InventoryContext = createContext<InventoryContextType | undefined>(
  undefined
);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [itemMaster, setItemMasterState] = useState<InventoryItem[]>([]);
  const [auditedItems, setAuditedItemsState] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>("all");
  const { currentUser } = useUser();   
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<
    QuestionnaireAnswer[]
  >([]);

  const { selectedCompanyId, selectedAssignmentId } = useCompany();

  const loadData = async () => {
    if (!selectedCompanyId) return;
    try {
      const dbItems = await SupabaseDataService.getItemMaster(selectedCompanyId, selectedAssignmentId);
      setItemMasterState(dbItems);

      const audited = await SupabaseDataService.getAuditedItems(selectedCompanyId, selectedAssignmentId);
      setAuditedItemsState(audited);

      const locs = await SupabaseDataService.getLocations();
      const filteredLocs = locs.filter((l) => l.companyId === selectedCompanyId);
      setLocations(filteredLocs);

      const qs = await SupabaseDataService.getQuestions(selectedCompanyId);
      setQuestions((qs || []).map((q: any) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        required: q.required,
        options: q.options || [],
        companyId: q.company_id ?? selectedCompanyId,
      })));

      const answers = await SupabaseDataService.getQuestionnaireAnswers(selectedCompanyId);
      setQuestionnaireAnswers(answers || []);

      const fetchedAssignments = await SupabaseDataService.getAssignments(selectedCompanyId);
      setAssignments(fetchedAssignments);

    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCompanyId, selectedAssignmentId]);

  const setItemMaster = async (
    items: Omit<InventoryItem, "id">[],
    companyId: string | null
  ) => {
    const itemsWithAuditors = items.map((item) => ({
      ...item,
      auditorEntries: [],
    }));

    if (!companyId) throw new Error("No company selected.");

    await SupabaseDataService.setItemMaster(itemsWithAuditors, companyId);
    await loadData();
  };

  const setClosingStock = async (
    items: Partial<InventoryItem>[],
    companyId: string | null,
    assignmentId: string
  ): Promise<void> => {
    if (!companyId) throw new Error("No company selected.");
    if (!assignmentId) throw new Error("No assignment selected.");

    if (itemMaster.length === 0) throw new Error("Item master is empty.");

    const finalItemsToUpsert: Partial<InventoryItem>[] = [];
    const masterMap = new Map<string, InventoryItem>();
    itemMaster.forEach((item) => {
      masterMap.set(item.sku, item); 
    });

    for (const stockItem of items) {
       const metadataSource = masterMap.get(stockItem.sku as string);
       
       finalItemsToUpsert.push({
          sku: stockItem.sku,
          name: metadataSource?.name || stockItem.name || "Unnamed Item",
          category: metadataSource?.category || stockItem.category || "",
          location: stockItem.location as string,
          systemQuantity: stockItem.systemQuantity as number,
          physicalQuantity: 0,
          status: "pending",
          auditorEntries: [],
          companyId: companyId,
          uploadBatchKey: stockItem.uploadBatchKey,
          assignmentId: parseInt(assignmentId)
       });
    }

    await SupabaseDataService.setClosingStock(finalItemsToUpsert, companyId, assignmentId);
    await loadData();
  };

  const updateAuditedItem = async (
    item: InventoryItem,
    auditorId?: string,
    auditorName?: string
  ) => {
    let statusToCheck: AuditStatus | undefined;
    if (selectedAssignmentId) {
      const assignment = assignments.find(a => a.id === selectedAssignmentId);
      statusToCheck = assignment?.status;
    } else {
      const loc = locations.find(l => l.name === item.location);
      statusToCheck = loc?.auditStatus;
    }

    // STRICT FINALIZATION CHECK
    if (statusToCheck === 'finalized') {
       throw new Error("Audit is finalized. No further modifications allowed.");
    }

    if (statusToCheck === 'submitted') {
      const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
      if (!isSuperAdmin) {
        throw new Error(`Audit is ${statusToCheck}. Modifications are restricted to Admins.`);
      }
    }
    
    let targetId = item.id;
    let targetAssignmentId = item.assignmentId;

    if (selectedAssignmentId) {
        const selectedIdNum = parseInt(selectedAssignmentId);
        
        if (targetAssignmentId !== selectedIdNum) {
            
            const existingFork = auditedItems.find(i => 
                i.sku === item.sku && 
                i.location === item.location && 
                i.assignmentId === selectedIdNum
            );
            
            if (existingFork) {
                targetId = existingFork.id;
                targetAssignmentId = selectedIdNum;
                item.auditorEntries = existingFork.auditorEntries;
            } else {
                targetId = undefined as any; 
                targetAssignmentId = selectedIdNum;
                item.auditorEntries = []; 
            }
        }
    }

    let auditorEntries: AuditorEntry[] = item.auditorEntries || [];
    let totalPhysicalQuantity = 0;

    if (auditorId && auditorName && item.physicalQuantity !== undefined) {
      const existingEntryIndex = auditorEntries.findIndex(
        (e) => e.auditorId === auditorId
      );

      if (existingEntryIndex >= 0) {
        auditorEntries[existingEntryIndex] = {
          auditorId,
          auditorName,
          quantityFound: item.physicalQuantity,
          auditedAt: new Date().toISOString(),
        };
      } else {
        auditorEntries.push({
          auditorId,
          auditorName,
          quantityFound: item.physicalQuantity,
          auditedAt: new Date().toISOString(),
        });
      }

      totalPhysicalQuantity = auditorEntries.reduce(
        (sum, entry) => sum + entry.quantityFound,
        0
      );
    } else {
      totalPhysicalQuantity = item.physicalQuantity || 0;
    }

    const itemToUpdate: InventoryItem = {
      ...item,
      id: targetId, 
      assignmentId: targetAssignmentId, 
      physicalQuantity: totalPhysicalQuantity,
      status:
        totalPhysicalQuantity !== undefined &&
        item.systemQuantity === totalPhysicalQuantity
          ? "matched"
          : totalPhysicalQuantity !== undefined
          ? "discrepancy"
          : "pending",
      lastAudited: new Date().toISOString(),
      auditorEntries,
    };

    await SupabaseDataService.setAuditedItems([itemToUpdate]);
    
    if (!targetId) {
        await loadData();
    } else {
        setAuditedItemsState(prev => {
          const idx = prev.findIndex(i => i.id === itemToUpdate.id);
          if (idx >= 0) {
            const newArr = [...prev];
            newArr[idx] = itemToUpdate;
            return newArr;
          }
          return [...prev, itemToUpdate];
        });
    }
  };

  const updateItemRemark = async (itemId: string, remark: string) => {
    
    const item = itemMaster.find(i => i.id === itemId);
    if (item) {
        let statusToCheck: AuditStatus | undefined;
        if (selectedAssignmentId) {
            const assignment = assignments.find(a => a.id === selectedAssignmentId);
            statusToCheck = assignment?.status;
        } else {
            const loc = locations.find(l => l.name === item.location);
            statusToCheck = loc?.auditStatus;
        }

        if (statusToCheck === 'finalized') {
            throw new Error("Audit is finalized. Remarks cannot be edited.");
        }
    }

    const updatedItems = itemMaster.map(item => 
      item.id === itemId ? { ...item, clientRemarks: remark } : item
    );
    setItemMasterState(updatedItems);
    await SupabaseDataService.updateItemRemark(itemId, remark);
  };

  const updateLocationAuditStatus = async (locationId: string, status: AuditStatus) => {
    const updatedLocations = locations.map(loc => 
      loc.id === locationId ? { ...loc, auditStatus: status } : loc
    );
    setLocations(updatedLocations);
    await SupabaseDataService.updateLocationAuditStatus(locationId, status);
  };

  const createAssignment = async (locationId: string, companyId: string, status: AuditStatus, date?: string, auditorIds?: string[]) => {
    const scheduledDate = date || new Date().toISOString();
    
    const newAssignment = await SupabaseDataService.createAssignment({
      locationId,
      companyId,
      status,
      scheduledDate,
      auditorIds
    });
    setAssignments(prev => [newAssignment, ...prev]);

    if (status === 'active' || status === 'pending') {
       await updateLocationAuditStatus(locationId, 'active');
    }
  };

  const updateAssignment = async (id: number, status: AuditStatus, date?: string, auditorIds?: string[]) => {
    await SupabaseDataService.updateAssignment(id, { 
      status, 
      scheduledDate: date, 
      auditorIds
    });
    
    setAssignments(prev => prev.map(a => 
      a.id === id ? { 
        ...a, 
        status, 
        scheduledDate: date || a.scheduledDate, 
        auditorIds: auditorIds || a.auditorIds 
      } : a
    ));
  };

  const deleteAssignment = async (id: number) => {
    await SupabaseDataService.deleteAssignment(id);
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  const submitAudit = async (assignmentId: number) => {
    await updateAssignment(assignmentId, "submitted");
    const assignment = assignments.find(a => a.id === assignmentId);
    if (assignment) {
       await updateLocationAuditStatus(assignment.locationId, "submitted");
    }
    await loadData();
  };

  const sendFinalizationOtp = async (assignmentId: number): Promise<string> => {
    return await SupabaseDataService.sendAssignmentOtp(assignmentId);
  };

  const finalizeAudit = async (assignmentId: number, otp: string) => {
    if (!selectedCompanyId) throw new Error("No company selected");
    
    const isValid = await SupabaseDataService.verifyAssignmentOtp(assignmentId, otp);
    if (!isValid) throw new Error("Invalid Verification Code");
    
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) throw new Error("Assignment not found");
    
    const loc = locations.find(l => l.id === assignment.locationId);
    if (!loc) throw new Error("Location not found");

    const freshItems = await SupabaseDataService.getItemMaster(selectedCompanyId, assignmentId);
    const freshAudited = await SupabaseDataService.getAuditedItems(selectedCompanyId, assignmentId);

    const locationItems = freshItems.filter(i => i.location === loc.name);
    const locationAuditedItems = freshAudited.filter(i => i.location === loc.name);
    
    const totalItems = locationItems.length;
    const auditedCount = locationItems.filter(masterItem => {
        const auditedItem = locationAuditedItems.find(a => a.id === masterItem.id);
        return auditedItem && auditedItem.status !== 'pending';
    }).length;
    
    let matched = 0;
    let discrepancies = 0;
    locationItems.forEach(masterItem => {
        const audited = locationAuditedItems.find(a => a.id === masterItem.id);
        if (audited && audited.status !== 'pending') {
           if (audited.status === 'matched') matched++;
           else if (audited.status === 'discrepancy') discrepancies++;
        }
    });

    const summary = {
      totalItems,
      auditedItems: auditedCount,
      pendingItems: totalItems - auditedCount,
      matched,
      discrepancies
    };

    const reportData = {
      summary,
      items: locationItems.map(item => {
        const audited = locationAuditedItems.find(a => a.id === item.id);
        return {
          sku: item.sku,
          name: item.name,
          category: item.category,
          system_quantity: item.systemQuantity,
          physical_quantity: audited?.physicalQuantity || 0,
          status: audited?.status || 'pending',
          variance: (audited?.physicalQuantity || 0) - item.systemQuantity,
          remarks: item.clientRemarks,
          auditor_entries: audited?.auditorEntries
        };
      }),
      questionnaire: questionnaireAnswers.filter(a => a.locationId === loc.id)
    };

    await SupabaseDataService.createAuditReport({
      company_id: selectedCompanyId,
      location_id: loc.id,
      assignment_id: assignmentId,
      report_data: reportData,
      finalized_by: currentUser?.id
    });

    await updateAssignment(assignmentId, "finalized");
    await updateLocationAuditStatus(loc.id, "finalized");

    await loadData();
  };

  const addLocation = async (location: Omit<Location, "id">) => {
    const companyId = location.companyId || selectedCompanyId;
    if (!companyId) throw new Error("No company selected.");
    await SupabaseDataService.addLocation({ ...location, companyId });
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
    const item = itemMaster.find(
      (i) =>
        (i.id === barcode || i.sku === barcode) && i.location === locationName
    );

    if (!item) throw new Error(`Item not found`);

    await updateAuditedItem({
      ...item,
      physicalQuantity: (item.physicalQuantity ?? 0) + 1,
      status: "pending",
    });
  };

  const searchItem = (query: string): InventoryItem[] => {
    if (!query || query.length < 2) return [];
    const lowerCaseQuery = query.toLowerCase();
    return itemMaster.filter(
      (item) =>
        item.id?.toLowerCase().includes(lowerCaseQuery) ||
        item.sku?.toLowerCase().includes(lowerCaseQuery) ||
        item.name?.toLowerCase().includes(lowerCaseQuery) ||
        item.category?.toLowerCase().includes(lowerCaseQuery)
    );
  };

  const addItemToAudit = async (
    item: InventoryItem,
    quantity: number,
    auditorId?: string,
    auditorName?: string
  ) => {
    if (quantity < 0) return;
    const masterItem = itemMaster.find(
      (i) => i.sku === item.sku && i.location === item.location
    );
    if (!masterItem) throw new Error(`Item not in master list`);

    await updateAuditedItem(
      {
        ...masterItem,
        physicalQuantity: quantity,
        status: "pending",
        lastAudited: new Date().toISOString(),
      },
      auditorId,
      auditorName
    );
  };

  
  const addSurplusItem = async (item: { sku: string; name: string; category: string; physicalQuantity: number }) => {
    if (!selectedCompanyId || !selectedAssignmentId) throw new Error("No active assignment selected.");
    
    const assignment = assignments.find(a => a.id === selectedAssignmentId);
    if (!assignment) throw new Error("Assignment not found.");
    
    const loc = locations.find(l => l.id === assignment.locationId);
    if (!loc) throw new Error("Location not found.");

    const userName = (currentUser as any)?.name || currentUser?.email || "Unknown Auditor";

    await SupabaseDataService.addSurplusItem({
        item,
        companyId: selectedCompanyId,
        assignmentId: selectedAssignmentId,
        locationName: loc.name,
        userId: currentUser?.id,
        userName
    });
    
    await loadData();
  };

  const getInventorySummary = () => {
    const totalItems = itemMaster.filter((item) => item.location !== "").length;
    const activeAuditedItems = auditedItems.filter(
      (i) => i.status && i.status !== "pending"
    );
    const auditedItemKeys = new Set(
      activeAuditedItems.map((i) => `${i.sku}-${i.location}`)
    );
    const auditedItemsCount = auditedItemKeys.size;
    let matched = 0;
    let discrepancies = 0;
    itemMaster.forEach((masterItem) => {
      if (masterItem.location === "") return;
      const audited = activeAuditedItems.find(
        (a) => a.sku === masterItem.sku && a.location === masterItem.location
      );
      if (audited) {
        if (audited.status === "matched") matched++;
        else if (audited.status === "discrepancy") discrepancies++;
      }
    });
    return {
      totalItems,
      auditedItems: auditedItemsCount,
      pendingItems: totalItems - auditedItemsCount,
      matched,
      discrepancies,
    };
  };

  const getLocationSummary = (locationName: string) => {
    const locationItems = itemMaster.filter(
      (item) => item.location === locationName
    );
    const locationAuditedItems = auditedItems.filter(
      (item) => item.location === locationName && item.status && item.status !== "pending"
    );
    const totalItems = locationItems.length;
    const auditedItemsCount = locationAuditedItems.length;
    let matched = 0;
    let discrepancies = 0;
    locationItems.forEach((masterItem) => {
      const audited = locationAuditedItems.find(
        (a) => a.sku === masterItem.sku && a.location === masterItem.location
      );
      if (audited) {
        if (audited.status === "matched") matched++;
        else if (audited.status === "discrepancy") discrepancies++;
      }
    });
    return {
      totalItems,
      auditedItems: auditedItemsCount,
      pendingItems: totalItems - auditedItemsCount,
      matched,
      discrepancies,
    };
  };

  const addQuestion = async (question: Omit<Question, "id">) => {
    if (!selectedCompanyId) throw new Error("No company selected.");
    await SupabaseDataService.addQuestion({ ...question, companyId: selectedCompanyId });
    await loadData();
  };

  const updateQuestion = async (question: Question) => {
    await SupabaseDataService.updateQuestion(question);
    await loadData();
  };

  const deleteQuestion = async (questionId: string) => {
    await SupabaseDataService.deleteQuestion(questionId);
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
  };

 const saveQuestionnaireAnswer = async (
  answer: Omit<QuestionnaireAnswer, "answeredOn" | "answeredBy">
) => {
   
    let statusToCheck: AuditStatus | undefined;
    if (answer.assignmentId) {
        const assignment = assignments.find(a => a.id === answer.assignmentId);
        statusToCheck = assignment?.status;
    } else if (answer.locationId) {
        const loc = locations.find(l => l.id === answer.locationId);
        statusToCheck = loc?.auditStatus;
    }

    if (statusToCheck === 'finalized') {
        throw new Error("Audit is finalized. Cannot edit questionnaire.");
    }

    const answeredBy = (currentUser as any)?.name || currentUser?.email;
    const location = locations.find(loc => loc.id === answer.locationId);
    const companyId = location?.companyId;

    const newAnswer: QuestionnaireAnswer = {
      ...answer,
      answeredOn: new Date().toISOString(),
      answeredBy,                           
      companyId: companyId,                 
    };

    setQuestionnaireAnswers((prev) => {
      const existingIndex = prev.findIndex(
        (a) =>
          a.questionId === answer.questionId &&
          a.assignmentId === answer.assignmentId 
      );
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = newAnswer;
        return updated;
      }
      return [...prev, newAnswer];
    });

    await SupabaseDataService.upsertQuestionnaireAnswer(newAnswer);
  };

  const getLocationQuestionnaireAnswers = (locationId: string): QuestionnaireAnswer[] => {
    return questionnaireAnswers.filter((answer) => answer.locationId === locationId);
  };
  
  const getAssignmentQuestionnaireAnswers = (assignmentId: number): QuestionnaireAnswer[] => {
    return questionnaireAnswers.filter((answer) => answer.assignmentId === assignmentId);
  };

  const getQuestionsForLocation = (locationId: string): Question[] => {
    const loc = locations.find((l) => l.id === locationId);
    const companyId = loc?.companyId ?? selectedCompanyId;
    if (!companyId) return questions;
    return questions.filter((q) => !q.companyId || q.companyId === companyId);
  };

  const getQuestionById = (questionId: string): Question | undefined => {
    return questions.find((q) => q.id === questionId);
  };

  const clearAllData = async () => {
    if (!selectedCompanyId) throw new Error("No company selected.");
    await SupabaseDataService.clearInventoryData(selectedCompanyId);
    setItemMasterState([]);
    setAuditedItemsState([]);
    setQuestionnaireAnswers([]);
    setAssignments([]);
  };

  return (
    <InventoryContext.Provider
      value={{
        itemMaster,
        closingStock: [],
        auditedItems,
        assignments, 
        locations,
        questions,
        questionnaireAnswers,
        selectedLocationFilter,
        setSelectedLocationFilter,
        setItemMaster,
        setClosingStock,
        updateAuditedItem,
        updateItemRemark,
        updateLocationAuditStatus,
        getInventorySummary,
        getLocationSummary,
        clearAllData,
        addLocation,
        updateLocation,
        deleteLocation,
        scanItem,
        searchItem,
        addItemToAudit,
        addSurplusItem,
        addQuestion,
        updateQuestion,
        deleteQuestion,
        saveQuestionnaireAnswer,
        getLocationQuestionnaireAnswers,
        getAssignmentQuestionnaireAnswers,
        getQuestionsForLocation,
        getQuestionById,
        createAssignment, 
        updateAssignment, 
        deleteAssignment,
        submitAudit, 
        sendFinalizationOtp,
        finalizeAudit
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }
  return context;
};