import React, { createContext, useContext, useState, useEffect } from "react";
import SupabaseDataService from "@/services/SupabaseDataService";
import { useCompany } from "@/context/CompanyContext";

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
}

export interface Location {
  id: string;
  name: string;
  description?: string;
  active?: boolean;
  companyId?: string;
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
}

export interface QuestionnaireAnswer {
  questionId: string;
  locationId: string;
  answer: string | string[];
  answeredBy?: string;
  answeredOn: string;
}

interface InventoryContextType {
  itemMaster: InventoryItem[];
  closingStock: InventoryItem[];
  auditedItems: InventoryItem[];
  locations: Location[];
  questions: Question[];
  questionnaireAnswers: QuestionnaireAnswer[];
  setItemMaster: (
    items: Omit<InventoryItem, "id">[],
    companyId: string | null
  ) => Promise<void>;
  // 🔹 typed items as Partial<InventoryItem>[] so uploadBatchKey is preserved
  setClosingStock: (
    items: Partial<InventoryItem>[],
    companyId: string | null
  ) => Promise<void>;
  updateAuditedItem: (
    item: InventoryItem,
    auditorId?: string,
    auditorName?: string
  ) => Promise<void>;
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
  clearAllData: () => void;
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
  addQuestion: (question: Omit<Question, "id">) => Promise<void>;
  updateQuestion: (question: Question) => Promise<void>;
  deleteQuestion: (questionId: string) => Promise<void>;
  saveQuestionnaireAnswer: (
    answer: Omit<QuestionnaireAnswer, "answeredOn" | "answeredBy">
  ) => Promise<void>;
  getLocationQuestionnaireAnswers: (locationId: string) => QuestionnaireAnswer[];
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
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<
    QuestionnaireAnswer[]
  >([]);

  // 🔹 currently-selected company (null = all companies / admin view)
  const { selectedCompanyId } = useCompany();

  // 🔹 Load / reload data whenever the selected company changes
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("Loading inventory data for company:", selectedCompanyId);

        // Items for selected company (or all if none selected)
        const dbItems = await SupabaseDataService.getItemMaster(
          selectedCompanyId || undefined
        );
        console.log("Loaded items:", dbItems.length);
        setItemMasterState(dbItems);

        // Audited items for selected company
        const audited = await SupabaseDataService.getAuditedItems(
          selectedCompanyId || undefined
        );
        console.log("Loaded audited items:", audited.length);
        setAuditedItemsState(audited);

        // Locations: get all from DB, then filter by company in memory
        const locs = await SupabaseDataService.getLocations();
        const filteredLocs = selectedCompanyId
          ? locs.filter((l) => l.companyId === selectedCompanyId)
          : locs;
        console.log("Loaded locations:", filteredLocs.length);
        setLocations(filteredLocs);

        const qs = await SupabaseDataService.getQuestions();
        console.log("Loaded questions:", qs?.length || 0);
        setQuestions(qs || []);

        const answers = await SupabaseDataService.getQuestionnaireAnswers();
        console.log("Loaded answers:", answers?.length || 0);
        setQuestionnaireAnswers(answers || []);

        console.log("All data loaded successfully");
      } catch (error) {
        console.error("Error loading inventory data:", error);
      }
    };

    loadData();
  }, [selectedCompanyId]);

  // 🔹 Upload Item Master – company-scoped
  const setItemMaster = async (
    items: Omit<InventoryItem, "id">[],
    companyId: string | null
  ) => {
    const itemsWithAuditors = items.map((item) => ({
      ...item,
      auditorEntries: [],
    }));

    if (!companyId) {
      throw new Error("No company selected. Cannot upload item master.");
    }

    await SupabaseDataService.setItemMaster(itemsWithAuditors, companyId);

    // Reload just this company's items
    const dbItems = await SupabaseDataService.getItemMaster(companyId);
    setItemMasterState(dbItems);
  };

  // 🔹 Upload Closing Stock – company-scoped
  //    IMPORTANT: preserve uploadBatchKey coming from FileUploader
  const setClosingStock = async (
    items: Partial<InventoryItem>[],
    companyId: string | null
  ): Promise<void> => {
    if (!companyId) {
      throw new Error(
        "No company selected. Cannot upload closing stock without company."
      );
    }

    if (itemMaster.length === 0) {
      throw new Error(
        "Item master is empty. Please upload item master before uploading closing stock."
      );
    }

    const uploadSKUs = items.map((item) => item.sku as string);
    const masterSKUs = new Set(itemMaster.map((item) => item.sku));
    const missingSKUs = uploadSKUs.filter((sku) => !masterSKUs.has(sku));

    if (missingSKUs.length > 0) {
      throw new Error(
        `The following SKUs are not in the item master: ${[
          ...new Set(missingSKUs),
        ].join(", ")}. ` +
          `Only items from the master list can be uploaded in closing stock.`
      );
    }

    const finalItemsToUpsert: Partial<InventoryItem>[] = [];

    for (const stockItem of items) {
      const existingItemAtLocation = itemMaster.find(
        (item) =>
          item.sku === stockItem.sku && item.location === stockItem.location
      );

      if (existingItemAtLocation) {
        // 🔹 existing row for this (sku, location) – update it, keep new uploadBatchKey
        finalItemsToUpsert.push({
          id: existingItemAtLocation.id,
          sku: stockItem.sku,
          name: existingItemAtLocation.name || "Unnamed Item",
          category: existingItemAtLocation.category || "",
          location: stockItem.location as string,
          systemQuantity: stockItem.systemQuantity as number,
          physicalQuantity: existingItemAtLocation.physicalQuantity || 0,
          status: existingItemAtLocation.status || "pending",
          lastAudited: existingItemAtLocation.lastAudited,
          notes: existingItemAtLocation.notes,
          auditorEntries: existingItemAtLocation.auditorEntries || [],
          companyId: existingItemAtLocation.companyId ?? companyId,
          // ✅ preserve batch key from the upload
          uploadBatchKey: stockItem.uploadBatchKey,
        });
      } else {
        // 🔹 no row yet for this location – copy metadata from blueprint / any item with same SKU
        const blueprint = itemMaster.find(
          (item) =>
            item.sku === stockItem.sku &&
            (!item.location || item.location === "")
        );

        const anyItemWithSKU = itemMaster.find(
          (item) => item.sku === stockItem.sku
        );
        const metadataSource = blueprint || anyItemWithSKU;

        if (!metadataSource) {
          throw new Error(`SKU ${stockItem.sku} not found in item master`);
        }

        finalItemsToUpsert.push({
          sku: stockItem.sku,
          name: metadataSource.name || "Unnamed Item",
          category: metadataSource.category || "",
          location: stockItem.location as string,
          systemQuantity: stockItem.systemQuantity as number,
          physicalQuantity: 0,
          status: "pending",
          auditorEntries: [],
          companyId: metadataSource.companyId ?? companyId,
          // ✅ preserve batch key from the upload
          uploadBatchKey: stockItem.uploadBatchKey,
        });
      }
    }

    await SupabaseDataService.setClosingStock(finalItemsToUpsert, companyId);

    // Reload state for this company
    const dbItems = await SupabaseDataService.getItemMaster(companyId);
    setItemMasterState(dbItems);
    setAuditedItemsState(
      await SupabaseDataService.getAuditedItems(companyId)
    );
  };

  const updateAuditedItem = async (
    item: InventoryItem,
    auditorId?: string,
    auditorName?: string
  ) => {
    const existingItem = itemMaster.find(
      (i) => i.id === item.id && i.location === item.location
    );
    let auditorEntries: AuditorEntry[] = existingItem?.auditorEntries || [];

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
      physicalQuantity: totalPhysicalQuantity,
      status:
        totalPhysicalQuantity !== undefined &&
        item.systemQuantity === totalPhysicalQuantity
          ? "matched"
          : totalPhysicalQuantity !== undefined
          ? "discrepancy"
          : "pending",
      lastAudited: new Date().toISOString(),
      auditorEntries: auditorEntries,
    };

    await SupabaseDataService.setAuditedItems([itemToUpdate]);

    const dbItems = await SupabaseDataService.getItemMaster(
      selectedCompanyId || undefined
    );
    setItemMasterState(dbItems);
    setAuditedItemsState(
      await SupabaseDataService.getAuditedItems(
        selectedCompanyId || undefined
      )
    );
  };

  const addLocation = async (location: Omit<Location, "id">) => {
    try {
      console.log("Adding location:", location);

      const companyIdFromPayload = location.companyId;
      const companyIdFromSession =
        typeof window !== "undefined"
          ? sessionStorage.getItem("selectedCompanyId")
          : null;
      const companyIdFromLocal =
        typeof window !== "undefined"
          ? localStorage.getItem("selectedCompanyId")
          : null;

      const companyId =
        companyIdFromPayload || companyIdFromSession || companyIdFromLocal;

      if (!companyId) {
        throw new Error(
          "No company selected. Cannot create location without company_id."
        );
      }

      const cleanLocation: Omit<Location, "id"> = {
        name: location.name.trim(),
        active: location.active !== undefined ? location.active : true,
        companyId,
      };

      if (location.description && location.description.trim()) {
        cleanLocation.description = location.description.trim();
      }

      console.log(
        "Calling SupabaseDataService.addLocation with:",
        cleanLocation
      );

      await SupabaseDataService.addLocation(cleanLocation);

      console.log("Location saved, reloading locations...");

      const updatedLocations = await SupabaseDataService.getLocations();
      const filteredLocs = selectedCompanyId
        ? updatedLocations.filter((l) => l.companyId === selectedCompanyId)
        : updatedLocations;
      setLocations(filteredLocs);

      console.log("Locations reloaded:", filteredLocs.length);
    } catch (error) {
      console.error("Error in addLocation:", error);
      throw error;
    }
  };

  const updateLocation = async (location: Location) => {
    await SupabaseDataService.updateLocation(location);
    const locs = await SupabaseDataService.getLocations();
    const filteredLocs = selectedCompanyId
      ? locs.filter((l) => l.companyId === selectedCompanyId)
      : locs;
    setLocations(filteredLocs);
  };

  const deleteLocation = async (locationId: string) => {
    const locationToDelete = locations.find((loc) => loc.id === locationId);
    if (!locationToDelete) return;
    const itemsInLocation = itemMaster.some(
      (item) => item.location === locationToDelete.name
    );
    if (itemsInLocation) {
      throw new Error("Cannot delete location that contains inventory items");
    }
    await SupabaseDataService.deleteLocation(locationId);
    const locs = await SupabaseDataService.getLocations();
    const filteredLocs = selectedCompanyId
      ? locs.filter((l) => l.companyId === selectedCompanyId)
      : locs;
    setLocations(filteredLocs);
  };

  const scanItem = async (barcode: string, locationName: string) => {
    const item = itemMaster.find(
      (i) =>
        (i.id === barcode || i.sku === barcode) && i.location === locationName
    );

    if (!item) {
      throw new Error(
        `Item with barcode ${barcode} not found at location ${locationName}`
      );
    }

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

    if (!masterItem) {
      throw new Error(
        `Cannot add item: SKU "${item.sku}" does not exist in the item master for location "${item.location}". ` +
          `Only items from the master list can be audited.`
      );
    }

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

  const getInventorySummary = () => {
    const totalItems = itemMaster.filter((item) => item.location !== "").length;
    const auditedItemKeys = new Set(
      auditedItems.map((i) => `${i.sku}-${i.location}`)
    );
    const auditedItemsCount = auditedItemKeys.size;
    let matched = 0;
    let discrepancies = 0;
    itemMaster.forEach((masterItem) => {
      if (masterItem.location === "") return;
      const audited = auditedItems.find(
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
      (item) => item.location === locationName
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
    const newQuestion = await SupabaseDataService.addQuestion(question);
    if (newQuestion) setQuestions((prev) => [...prev, newQuestion]);
  };

  const updateQuestion = async (question: Question) => {
    await SupabaseDataService.updateQuestion(question);
    setQuestions((prev) =>
      prev.map((q) => (q.id === question.id ? question : q))
    );
  };

  const deleteQuestion = async (questionId: string) => {
    await SupabaseDataService.deleteQuestion(questionId);
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    setQuestionnaireAnswers((prev) =>
      prev.filter((a) => a.questionId !== questionId)
    );
  };

  const saveQuestionnaireAnswer = async (
    answer: Omit<QuestionnaireAnswer, "answeredOn" | "answeredBy">
  ) => {
    const newAnswer: QuestionnaireAnswer = {
      ...answer,
      answeredOn: new Date().toISOString(),
    };
    setQuestionnaireAnswers((prev) => {
      const existingIndex = prev.findIndex(
        (a) =>
          a.questionId === answer.questionId &&
          a.locationId === answer.locationId
      );
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = newAnswer;
        return updated;
      }
      return [...prev, newAnswer];
    });
    await SupabaseDataService.upsertQuestionnaireAnswer(answer);
  };

  const getLocationQuestionnaireAnswers = (
    locationId: string
  ): QuestionnaireAnswer[] => {
    return questionnaireAnswers.filter(
      (answer) => answer.locationId === locationId
    );
  };

  const getQuestionsForLocation = (_locationId: string): Question[] => {
    return questions;
  };

  const getQuestionById = (questionId: string): Question | undefined => {
    return questions.find((q) => q.id === questionId);
  };

  const clearAllData = async () => {
    await SupabaseDataService.clearInventoryData();
    setItemMasterState([]);
    setAuditedItemsState([]);
    setQuestionnaireAnswers([]);
  };

  return (
    <InventoryContext.Provider
      value={{
        itemMaster,
        closingStock: [],
        auditedItems,
        locations,
        questions,
        questionnaireAnswers,
        setItemMaster,
        setClosingStock,
        updateAuditedItem,
        getInventorySummary,
        getLocationSummary,
        clearAllData,
        addLocation,
        updateLocation,
        deleteLocation,
        scanItem,
        searchItem,
        addItemToAudit,
        addQuestion,
        updateQuestion,
        deleteQuestion,
        saveQuestionnaireAnswer,
        getLocationQuestionnaireAnswers,
        getQuestionsForLocation,
        getQuestionById,
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
