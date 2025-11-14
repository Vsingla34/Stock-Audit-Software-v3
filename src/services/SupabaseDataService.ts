// src/services/supabaseDataService.ts
import { supabase } from "@/integrations/supabase/client";
import {
  InventoryItem,
  Location,
  QuestionnaireAnswer,
} from "@/context/InventoryContext";

class SupabaseDataService {
  private dbToInventoryItem(dbItem: any): InventoryItem {
    let auditorEntries = [];
    try {
      if (dbItem.auditor_entries) {
        if (typeof dbItem.auditor_entries === "string") {
          auditorEntries = JSON.parse(dbItem.auditor_entries);
        } else if (Array.isArray(dbItem.auditor_entries)) {
          auditorEntries = dbItem.auditor_entries;
        }
      }
    } catch {
      auditorEntries = [];
    }

    return {
      id: String(dbItem.id || ""),
      sku: String(dbItem.sku || ""),
      name: dbItem.name,
      category: dbItem.category,
      location: dbItem.location || "",
      systemQuantity: Number(dbItem.system_quantity) || 0,
      physicalQuantity: dbItem.physical_quantity,
      status: dbItem.status as "pending" | "matched" | "discrepancy",
      lastAudited: dbItem.last_audited,
      notes: dbItem.notes,
      auditorEntries,
      companyId: dbItem.company_id ?? undefined,
      uploadBatchKey: dbItem.upload_batch_key ?? undefined,
    };
  }

  private inventoryItemToDb(item: Partial<InventoryItem>): any {
    const dbItem: any = {
      sku: item.sku,
      name: item.name || "Unnamed Item",
      category: item.category || "",
      location: item.location || "",
      system_quantity: item.systemQuantity || 0,
      physical_quantity: item.physicalQuantity,
      status: item.status || "pending",
      last_audited: item.lastAudited,
      notes: item.notes || null,
    };

    if (item.uploadBatchKey) {
      dbItem.upload_batch_key = item.uploadBatchKey;
    }

    if (
      item.auditorEntries &&
      Array.isArray(item.auditorEntries) &&
      item.auditorEntries.length > 0
    ) {
      try {
        dbItem.auditor_entries = JSON.stringify(item.auditorEntries);
      } catch {
        dbItem.auditor_entries = "[]";
      }
    } else {
      dbItem.auditor_entries = "[]";
    }

    if (item.id) {
      dbItem.id = item.id;
    }

    return dbItem;
  }

  // ---------- Upload history helpers ----------

  public async logUploadBatch(params: {
    batchKey: string;
    companyId: string;
    locationId?: string | null;
    locationName?: string | null;
    uploadType: "item_master" | "closing_stock";
    totalItems: number;
  }): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("inventory_upload_history").insert({
      batch_key: params.batchKey,
      company_id: params.companyId,
      location_id: params.locationId ?? null,
      location_name: params.locationName ?? null,
      upload_type: params.uploadType,
      total_items: params.totalItems,
      uploaded_by: user?.id ?? null,
    });

    if (error) throw error;
  }

  public async getUploadHistory(companyId: string) {
    const { data, error } = await supabase
      .from("inventory_upload_history")
      .select("*")
      .eq("company_id", companyId)
      .order("uploaded_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  public async deleteUploadBatch(batchKey: string): Promise<number> {
    const { data, error, count } = await supabase
      .from("inventory_items")
      .delete()
      .eq("upload_batch_key", batchKey)
      .select("id", { count: "exact" });

    if (error) throw error;

    const { error: historyError } = await supabase
      .from("inventory_upload_history")
      .delete()
      .eq("batch_key", batchKey);

    if (historyError) throw historyError;

    return count ?? (data ? data.length : 0);
  }

  // ---------- Item master / closing stock ----------

  public async hasItemMaster(): Promise<boolean> {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("id")
      .limit(1);

    if (error) throw error;
    return (data && data.length > 0) || false;
  }

  public async getItemMasterCount(): Promise<number> {
    const { count, error } = await supabase
      .from("inventory_items")
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    return count || 0;
  }

  public async validateSKUsExist(
    skus: string[]
  ): Promise<{ valid: boolean; missingSKUs: string[] }> {
    if (skus.length === 0) {
      return { valid: true, missingSKUs: [] };
    }

    try {
      const startTime = Date.now();

      const chunkSize = 500;
      const existingSKUsSet = new Set<string>();

      for (let i = 0; i < skus.length; i += chunkSize) {
        const skuChunk = skus.slice(i, i + chunkSize);

        let from = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from("inventory_items")
            .select("sku")
            .in("sku", skuChunk)
            .range(from, from + pageSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            data.forEach((item) => existingSKUsSet.add(item.sku));
            from += pageSize;
            hasMore = data.length === pageSize;
          } else {
            hasMore = false;
          }
        }
      }

      const missingSKUs = skus.filter((sku) => !existingSKUsSet.has(sku));
      const validationTime = Date.now() - startTime;

      console.log("SKU validation took", validationTime, "ms");

      return {
        valid: missingSKUs.length === 0,
        missingSKUs,
      };
    } catch (error) {
      console.error("Error validating SKUs:", error);
      throw error;
    }
  }

  public async setItemMaster(
    items: Partial<InventoryItem>[],
    companyId: string
  ): Promise<void> {
    const dbItems = items.map((item) => ({
      ...this.inventoryItemToDb(item),
      company_id: companyId,
    }));

    const { error } = await supabase.from("inventory_items").insert(dbItems);

    if (error) {
      throw error;
    }
  }

  public async getItemMaster(companyId?: string): Promise<InventoryItem[]> {
    let baseQuery = supabase.from("inventory_items").select("*");

    if (companyId) {
      baseQuery = baseQuery.eq("company_id", companyId);
    }

    try {
      let allItems: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await baseQuery.range(
          from,
          from + pageSize - 1
        );

        if (error) throw error;

        if (data && data.length > 0) {
          allItems = allItems.concat(data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`✅ Total items fetched: ${allItems.length}`);
      return allItems.map((item) => this.dbToInventoryItem(item));
    } catch (error) {
      console.error("Error fetching item master:", error);
      throw error;
    }
  }

  public async setClosingStock(
    items: Partial<InventoryItem>[],
    companyId: string
  ): Promise<void> {
    if (items.length === 0) {
      throw new Error("Cannot upload empty closing stock");
    }

    const hasMaster = await this.hasItemMaster();
    if (!hasMaster) {
      throw new Error(
        "VALIDATION_ERROR: Item master must be uploaded before closing stock. Please contact admin to upload item master first."
      );
    }

    const skus = items.map((item) => item.sku).filter(Boolean) as string[];
    const validation = await this.validateSKUsExist(skus);

    if (!validation.valid) {
      throw new Error(
        `VALIDATION_ERROR: The following SKUs do not exist in item master: ${validation.missingSKUs.join(
          ", "
        )}. ` + `Only items from the master list can be uploaded.`
      );
    }

    const dbItems = items.map((item) => ({
      ...this.inventoryItemToDb(item),
      company_id: item.companyId ?? companyId,
    }));

    const { error } = await supabase
      .from("inventory_items")
      .upsert(dbItems, {
        onConflict: "id",
      });

    if (error) {
      throw error;
    }
  }

  // ---------- Audit items ----------

  public async setAuditedItems(items: InventoryItem[]): Promise<void> {
    if (items.length > 0) {
      const dbItems = items.map((item) => this.inventoryItemToDb(item));
      const { error } = await supabase
        .from("inventory_items")
        .upsert(dbItems, { onConflict: "id" });
      if (error) throw error;
    }
  }

  // now supports optional company filter
  public async getAuditedItems(
    companyId?: string
  ): Promise<InventoryItem[]> {
    try {
      let allItems: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      let baseQuery = supabase
        .from("inventory_items")
        .select("*")
        .in("status", ["matched", "discrepancy"]);

      if (companyId) {
        baseQuery = baseQuery.eq("company_id", companyId);
      }

      while (hasMore) {
        const { data, error } = await baseQuery.range(
          from,
          from + pageSize - 1
        );

        if (error) throw error;

        if (data && data.length > 0) {
          allItems = allItems.concat(data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allItems.map((item) => this.dbToInventoryItem(item));
    } catch (error) {
      throw error;
    }
  }

  // ---------- Locations ----------

  public async addLocation(
    location: Omit<Location, "id">
  ): Promise<Location> {
    try {
      const { companyId, ...rest } = location;

      const payload: any = {
        ...rest,
        company_id: companyId ?? null,
      };

      const { data, error } = await supabase
        .from("locations")
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error("Error inserting location:", error);
        throw error;
      }

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        active: data.active,
        companyId: data.company_id ?? undefined,
      };
    } catch (error) {
      throw error;
    }
  }

  public async updateLocation(location: Location): Promise<void> {
    try {
      const { id, ...updateData } = location;

      const cleanData: any = {};

      if (updateData.name !== undefined) cleanData.name = updateData.name;
      if (updateData.description !== undefined)
        cleanData.description = updateData.description;
      if (updateData.active !== undefined) cleanData.active = updateData.active;
      if (updateData.companyId !== undefined)
        cleanData.company_id = updateData.companyId;

      const { error } = await supabase
        .from("locations")
        .update(cleanData)
        .eq("id", id);

      if (error) {
        console.error("Error updating location:", error);
        throw error;
      }
    } catch (error) {
      throw error;
    }
  }

  public async getLocations(): Promise<Location[]> {
    try {
      let allLocations: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("locations")
          .select("*")
          .order("name")
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allLocations = allLocations.concat(data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`Fetched ${allLocations.length} locations from database`);
      return allLocations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        description: loc.description,
        active: loc.active,
        companyId: loc.company_id ?? undefined,
      }));
    } catch (error) {
      throw error;
    }
  }

  public async deleteLocation(locationId: string): Promise<void> {
    const { error } = await supabase
      .from("locations")
      .delete()
      .eq("id", locationId);
    if (error) throw error;
  }

  // ---------- Questionnaire ----------

  public async getQuestions(companyId?: string): Promise<any[]> {
    try {
      let allQuestions: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("questions")
          .select("*")
          .order("created_at");

        if (companyId) {
          query = query.eq("company_id", companyId);
        }

        const { data, error } = await query.range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allQuestions = allQuestions.concat(data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allQuestions;
    } catch (error) {
      throw error;
    }
  }

  public async addQuestion(questionData: any): Promise<any> {
    const payload: any = { ...questionData };

    if (payload.companyId !== undefined) {
      payload.company_id = payload.companyId;
      delete payload.companyId;
    }

    const { data, error } = await supabase
      .from("questions")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  public async updateQuestion(questionData: any): Promise<void> {
    const { id, ...updateData } = questionData;
    const { error } = await supabase
      .from("questions")
      .update(updateData)
      .eq("id", id);
    if (error) throw error;
  }

  public async deleteQuestion(questionId: string): Promise<void> {
    const { error } = await supabase
      .from("questions")
      .delete()
      .eq("id", questionId);
    if (error) throw error;
  }

  public async getQuestionnaireAnswers(): Promise<QuestionnaireAnswer[]> {
    try {
      let allAnswers: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("questionnaire_answers")
          .select("*")
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allAnswers = allAnswers.concat(data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allAnswers.map((ans) => ({
        questionId: ans.question_id,
        locationId: ans.location_id,
        answer: ans.answer,
        answeredBy: ans.answered_by ?? undefined,
        answeredOn: ans.answered_on,
      }));
    } catch (error) {
      throw error;
    }
  }

 public async upsertQuestionnaireAnswer(
  answer: QuestionnaireAnswer
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const meta = user.user_metadata || {};
  const answeredBy =
    answer.answeredBy ||
    (meta.name as string) ||
    (meta.full_name as string) ||
    (meta.display_name as string) ||
    user.email ||
    user.id;

  const answerToUpsert = {
    question_id: answer.questionId,
    location_id: answer.locationId,
    answer: answer.answer,
    answered_by: answeredBy,
    answered_on: answer.answeredOn || new Date().toISOString(),
  };

  const { error } = await supabase
    .from("questionnaire_answers")
    .upsert(answerToUpsert); // no onConflict to avoid 42P10

  if (error) throw error;
}


  // ---------- Global clear ----------

  public async clearInventoryData(): Promise<void> {
    try {
      await supabase
        .from("inventory_items")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase
        .from("questionnaire_answers")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
    } catch (error) {
      throw error;
    }
  }
}

export default new SupabaseDataService();
