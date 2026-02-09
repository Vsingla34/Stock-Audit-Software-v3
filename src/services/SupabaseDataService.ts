import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import {
  InventoryItem,
  AuditStatus,
  Assignment,
} from "@/context/InventoryContext";

class SupabaseDataService {
  
  public currentUser: any = null; 
  private pendingVerificationEmail: string | null = null;

  constructor() {
    this.initUser();
  }

  private async initUser() {
    const { data } = await supabase.auth.getUser();
    this.currentUser = data.user;
  }

  public async uploadFile(file: File, path: string): Promise<string> {
    const { error } = await supabase.storage
      .from("audit-attachments")
      .upload(path, file, {
        upsert: true,
      });

    if (error) {
      console.error("Upload error:", error);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from("audit-attachments")
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  }

  public async getAssignments(companyId?: string): Promise<Assignment[]> {
    let query = supabase.from("assignments").select("*");
    if (companyId) {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(item => {
      let audIds: string[] = [];
      if (Array.isArray(item.auditor_ids)) {
        audIds = item.auditor_ids;
      } else if (typeof item.auditor_ids === 'string') {
        audIds = [item.auditor_ids];
      }

      return {
        id: item.id,
        locationId: item.location_id,
        companyId: item.company_id,
        auditorId: audIds.join(','), 
        auditorIds: audIds,
        status: item.status as AuditStatus,
        scheduledDate: item.scheduled_date || item.created_at
      } as any;
    });
  }

  public async createAssignment(assignment: { 
    locationId: string; 
    companyId: string; 
    status: AuditStatus; 
    scheduledDate?: string;
    auditorIds?: string[];
  }): Promise<Assignment> {
    const { data, error } = await supabase
      .from("assignments")
      .insert({
        location_id: assignment.locationId,
        company_id: assignment.companyId,
        status: assignment.status,
        scheduled_date: assignment.scheduledDate,
        auditor_ids: assignment.auditorIds || [] 
      })
      .select()
      .single();

    if (error) throw error;

    const audIds = Array.isArray(data.auditor_ids) ? data.auditor_ids : [];

    return {
      id: data.id,
      locationId: data.location_id,
      companyId: data.company_id,
      auditorId: audIds.join(','),
      auditorIds: audIds,
      status: data.status as AuditStatus,
      scheduledDate: data.scheduled_date || data.created_at
    } as any;
  }

  public async updateAssignment(id: number, updates: { 
    status?: AuditStatus; 
    scheduledDate?: string;
    auditorIds?: string[];
  }): Promise<void> {
    const payload: any = {};
    if (updates.status) payload.status = updates.status;
    if (updates.scheduledDate) payload.scheduled_date = updates.scheduledDate;
    
    if (updates.auditorIds !== undefined) {
      payload.auditor_ids = updates.auditorIds;
    }

    const { error } = await supabase
      .from("assignments")
      .update(payload)
      .eq("id", id);

    if (error) throw error;
  }

  public async deleteAssignment(id: number): Promise<void> {
    const { error: qaError } = await supabase
      .from("questionnaire_answers")
      .delete()
      .eq("assignment_id", id);
    if (qaError) throw qaError;

    const { error: uploadError } = await supabase
      .from("inventory_upload_history")
      .delete()
      .eq("assignment_id", id);
    if (uploadError) throw uploadError;

    const { error: reportError } = await supabase
      .from("audit_reports" as any)
      .delete()
      .eq("assignment_id", id);
    if (reportError) throw reportError;

    const { error: itemError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("assignment_id", id);
    if (itemError) throw itemError;

    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  public async sendAssignmentOtp(assignmentId: number): Promise<string> {
    const { data: assignment, error: assignError } = await supabase
      .from("assignments")
      .select("company_id")
      .eq("id", assignmentId)
      .single();

    if (assignError || !assignment) throw new Error("Assignment not found");

    const { data: clients, error: clientError } = await supabase
      .from("user_profiles")
      .select("email")
      .eq("role", "client")
      .contains("assigned_companies", [assignment.company_id]);

    if (clientError) throw clientError;

    if (!clients || clients.length === 0) {
      throw new Error("No client account found associated with this company.");
    }

    const targetEmail = clients[0].email;
    this.pendingVerificationEmail = targetEmail;

    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        shouldCreateUser: false, 
      }
    });

    if (error) throw error;

    return `Verification code sent to ${targetEmail}`;
  }

  public async verifyAssignmentOtp(assignmentId: number, otp: string): Promise<boolean> {
    if (!this.pendingVerificationEmail) {
      throw new Error("Session expired or invalid. Please resend code.");
    }

    const supabaseUrl = (supabase as any).supabaseUrl || process.env.VITE_SUPABASE_URL;
    const supabaseKey = (supabase as any).supabaseKey || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase configuration missing for verification.");
    }

    const tempClient = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await tempClient.auth.verifyOtp({
      email: this.pendingVerificationEmail,
      token: otp,
      type: 'email'
    });

    if (error || !data.user) {
      return false;
    }

    this.pendingVerificationEmail = null;
    return true;
  }

  // OPTIMIZED: Fetch all items with pagination & array push
  public async getItemMaster(companyId: string, assignmentId: number | null = null): Promise<InventoryItem[]> {
    const allItems: any[] = []; // Constant reference, mutate content
    let page = 0;
    const pageSize = 1000;

    while (true) {
        let query = supabase
          .from("inventory_items")
          .select("*")
          .eq("company_id", companyId);

        if (assignmentId) {
           query = query.or(`assignment_id.eq.${assignmentId},assignment_id.is.null`);
        } else {
           query = query.is("assignment_id", null);
        }

        // Apply Range for Pagination
        query = query.range(page * pageSize, (page + 1) * pageSize - 1);

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching item master:", error);
          throw error;
        }

        if (!data || data.length === 0) break;
        
        // Push items instead of spreading (More memory efficient)
        allItems.push(...data);
        
        if (data.length < pageSize) break;
        page++;
    }

    return allItems.map((item: any) => {
      let parsedEntries = [];
      if (Array.isArray(item.auditor_entries)) {
        parsedEntries = item.auditor_entries;
      } else if (typeof item.auditor_entries === 'string') {
        try { parsedEntries = JSON.parse(item.auditor_entries); } catch { parsedEntries = []; }
      }

      let parsedCustomAttributes = {};
      if (item.custom_attributes && typeof item.custom_attributes === 'object') {
          parsedCustomAttributes = item.custom_attributes;
      } else if (typeof item.custom_attributes === 'string') {
          try { parsedCustomAttributes = JSON.parse(item.custom_attributes); } catch { parsedCustomAttributes = {}; }
      }

      // CRITICAL FIX: Use custom attribute name as fallback if main name is empty
      let itemName = item.name;
      if (!itemName || itemName === "Unnamed Item") {
        // Check for name in custom attributes (case-insensitive)
        const customName = parsedCustomAttributes['Name'] || 
                          parsedCustomAttributes['name'] || 
                          parsedCustomAttributes['Item Name'] ||
                          parsedCustomAttributes['item_name'];
        if (customName) {
          itemName = customName;
        } else {
          itemName = "Unnamed Item";
        }
      }

      // CRITICAL FIX: Use custom attribute category as fallback if main category is empty
      let itemCategory = item.category;
      if (!itemCategory || itemCategory === "-") {
        const customCategory = parsedCustomAttributes['Category'] || 
                              parsedCustomAttributes['category'];
        if (customCategory) {
          itemCategory = customCategory;
        }
      }

      // CRITICAL FIX: Remove duplicate fields from customAttributes
      // This prevents duplicate columns in the UI (Name, Category, etc.)
      const reservedFields = ['sku', 'name', 'category', 'location', 'systemQuantity', 'physicalQuantity', 
                              'status', 'lastAudited', 'notes', 'clientRemarks', 'uploadBatchKey', 'assignmentId',
                              'id', 'companyId', 'auditorEntries', 'item_name', 'itemname'];
      
      const cleanedCustomAttributes = { ...parsedCustomAttributes };
      reservedFields.forEach(field => {
        delete cleanedCustomAttributes[field];
        // Also check lowercase/uppercase variations
        delete cleanedCustomAttributes[field.toLowerCase()];
        delete cleanedCustomAttributes[field.toUpperCase()];
      });

      return {
        id: item.id,
        sku: item.sku,
        name: itemName, 
        category: itemCategory,
        location: item.location,
        companyId: item.company_id,
        systemQuantity: item.system_quantity,
        physicalQuantity: item.physical_quantity,
        status: item.status as any,
        lastAudited: item.last_audited,
        notes: item.notes,
        auditorEntries: parsedEntries,
        clientRemarks: item.client_remarks,
        uploadBatchKey: item.upload_batch_key,
        assignmentId: item.assignment_id,
        customAttributes: cleanedCustomAttributes
      };
    });
  }

  // ENHANCED: Lightweight SKU Fetcher with Robust Pagination & Trimming
  public async getAllSkus(companyId: string): Promise<Set<string>> {
      const allSkus = new Set<string>();
      let page = 0;
      const pageSize = 1000; // Standard page size for reliable fetching
      let totalFetched = 0;

      console.log(`Starting SKU fetch for company ${companyId}...`);

      while(true) {
          const start = page * pageSize;
          const end = start + pageSize - 1;
          
          const { data, error } = await supabase
             .from("inventory_items")
             .select("sku")
             .eq("company_id", companyId)
             .is("assignment_id", null) // Only fetch Master Items
             .range(start, end);
          
          if (error) {
              console.error("Error fetching SKUs at page", page, error);
              throw error;
          }
          
          // If no data returned, we've reached the end
          if (!data || data.length === 0) break;

          // Populate Set with trimmed SKUs to prevent whitespace mismatches
          data.forEach(row => {
              if (row.sku) {
                  const trimmedSku = row.sku.trim();
                  if (trimmedSku) { // Only add non-empty SKUs
                      allSkus.add(trimmedSku);
                  }
              }
          });
          
          totalFetched += data.length;
          
          // If we got fewer items than pageSize, we've reached the end
          if (data.length < pageSize) {
              console.log(`Completed SKU fetch: ${totalFetched} rows processed, ${allSkus.size} unique SKUs`);
              break;
          }
          
          page++;
          
          // Log progress for large datasets
          if (page % 5 === 0) {
              console.log(`SKU fetch progress: page ${page}, ${totalFetched} rows, ${allSkus.size} unique SKUs so far...`);
          }
      }
      
      return allSkus;
  }

  public async getAuditedItems(companyId: string, assignmentId: number | null = null): Promise<InventoryItem[]> {
    return this.getItemMaster(companyId, assignmentId);
  }

  // ... inside SupabaseDataService class ...

  // Fetch sub-locations for a specific location
  public async getSubLocations(locationId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("sub_locations")
      .select("name")
      .eq("location_id", locationId)
      .order("name");

    if (error) {
      console.error("Error fetching sub-locations:", error);
      return [];
    }

    return data.map((item: any) => item.name);
  }

  // Create a new sub-location (Ignores if it already exists)
  public async createSubLocation(params: {
    name: string;
    locationId: string;
    companyId: string;
  }): Promise<void> {
    const { error } = await supabase
      .from("sub_locations")
      .insert({
        name: params.name,
        location_id: params.locationId,
        company_id: params.companyId
      })
      .select()
      .single();

    // Ignore unique constraint violation (code 23505) if user tries to add same name twice
    if (error && error.code !== '23505') {
      console.error("Error creating sub-location:", error);
      throw error;
    }
  }

  public async setItemMaster(items: Partial<InventoryItem>[], companyId: string): Promise<void> {
    if (items.length === 0) return;
    
    // Process upserts in chunks
    const CHUNK_SIZE = 500;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        
        const dbItems = chunk.map(item => ({
          sku: item.sku,
          name: item.name || "Unnamed Item",
          category: item.category,
          location: item.location,
          company_id: companyId,
          assignment_id: null, 
          system_quantity: item.systemQuantity || 0,
          physical_quantity: item.physicalQuantity || 0,
          status: item.status || 'pending',
          client_remarks: item.clientRemarks,
          auditor_entries: item.auditorEntries || [],
          upload_batch_key: item.uploadBatchKey,
          custom_attributes: item.customAttributes || {}
        }));

        const { error } = await supabase
          .from("inventory_items")
          .upsert(dbItems as any, { onConflict: 'company_id, assignment_id, sku' as any }); 

        if (error) throw error;
    }
  }

// src/services/SupabaseDataService.ts

// ... (Inside SupabaseDataService class)

  public async setClosingStock(items: Partial<InventoryItem>[], companyId: string, assignmentId: string): Promise<void> {
     if (items.length === 0) return;
     
     const assignmentIdInt = parseInt(assignmentId, 10);
     const CHUNK_SIZE = 500;
     
     for (let i = 0; i < items.length; i += CHUNK_SIZE) {
         const chunk = items.slice(i, i + CHUNK_SIZE);
         
         const dbItems = chunk.map(item => ({
           sku: item.sku,
           name: item.name || "Unnamed Item", // FIXED: Now mapping the name
           category: item.category || "-",    // FIXED: Now mapping the category
           location: item.location,
           company_id: companyId,
           assignment_id: assignmentIdInt, 
           system_quantity: item.systemQuantity,
           physical_quantity: 0, 
           status: 'pending',
           upload_batch_key: item.uploadBatchKey,
           custom_attributes: item.customAttributes || {}
         }));

         const { error } = await supabase
           .from("inventory_items")
           .upsert(dbItems as any, { onConflict: 'company_id, assignment_id, sku' as any });

         if (error) throw error;
     }
  }

  public async setAuditedItems(items: InventoryItem[]): Promise<void> {
    const dbItems = items.map(item => {
      const payload: any = {
        sku: item.sku,
        name: item.name,
        category: item.category,
        location: item.location,
        company_id: item.companyId,
        assignment_id: item.assignmentId,
        physical_quantity: item.physicalQuantity,
        status: item.status,
        last_audited: item.lastAudited,
        auditor_entries: item.auditorEntries,
        notes: item.notes,
        custom_attributes: item.customAttributes || {}
      };
      
      if (item.id) {
         payload.id = item.id;
      }
      
      return payload;
    });
    
    const { error } = await supabase
      .from("inventory_items")
      .upsert(dbItems, { onConflict: 'company_id, assignment_id, sku' as any });
      
    if (error) throw error;
  }

  public async addSurplusItem(params: {
    item: { sku: string; name: string; category: string; physicalQuantity: number };
    companyId: string;
    assignmentId: number;
    locationName: string;
    userId?: string;
    userName?: string;
  }): Promise<void> {
    const { item, companyId, assignmentId, locationName, userId, userName } = params;

    const auditorEntry = {
      auditorId: userId || 'unknown',
      auditorName: userName || 'Unknown',
      quantityFound: item.physicalQuantity,
      auditedAt: new Date().toISOString()
    };

    const payload = {
      company_id: companyId,
      assignment_id: assignmentId,
      sku: item.sku,
      name: item.name,
      category: item.category,
      location: locationName,
      system_quantity: 0, 
      physical_quantity: item.physicalQuantity,
      status: 'discrepancy', 
      client_remarks: "This item was not in the closing stock but it was there",
      auditor_entries: [auditorEntry],
      last_audited: new Date().toISOString(),
      custom_attributes: {}
    };

    const { error } = await supabase
      .from("inventory_items")
      .insert(payload);

    if (error) throw error;
  }

  public async updateItemRemark(itemId: string, remark: string): Promise<void> {
    const { error } = await supabase
      .from("inventory_items")
      .update({ client_remarks: remark } as any)
      .eq("id", itemId);
    if (error) throw error;
  }

  public async resetInventoryCounts(companyId: string, locationName: string, assignmentId?: number): Promise<void> {
    let query = supabase
      .from("inventory_items")
      .update({ physical_quantity: 0, status: 'pending', auditor_entries: [] } as any)
      .eq("company_id", companyId)
      .eq("location", locationName);

    if (assignmentId) {
      query = query.eq("assignment_id", assignmentId);
    }

    const { error } = await query;
    if (error) throw error;
  }

  public async createAuditReport(payload: any): Promise<void> {
    const finalReportData = {
      ...payload.report_data,
      metadata: {
        location_name: payload.location_name,
        assignment_date: payload.assignment_date,
        finalized_date: new Date().toISOString()
      }
    };

    const { error } = await supabase
      .from("audit_reports" as any) 
      .insert({
        company_id: payload.company_id,
        location_id: payload.location_id,
        assignment_id: payload.assignment_id,
        report_data: finalReportData,
        finalized_by: payload.finalized_by
      });
      
    if (error) throw error;
  }

  public async getAuditHistory(companyId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("audit_reports" as any)
      .select(`
        id,
        created_at,
        report_data,
        company_id,
        finalized_by,
        assignment_id,
        locations ( name ),
        assignments ( scheduled_date, auditor_ids )
      `)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const userIds = new Set<string>();
    data?.forEach((r: any) => {
        if (r.finalized_by) userIds.add(r.finalized_by);
        
        const rawAuditors = r.assignments?.auditor_ids;
        if (Array.isArray(rawAuditors)) {
            rawAuditors.forEach((id: string) => userIds.add(id));
        } else if (typeof rawAuditors === 'string') {
            userIds.add(rawAuditors);
        }
    });

    let userMap: Record<string, any> = {};
    if (userIds.size > 0) {
        const { data: users } = await supabase
            .from("user_profiles")
            .select("id, name, email")
            .in("id", Array.from(userIds));
        
        users?.forEach(u => { userMap[u.id] = u; });
    }

    return (data || []).map((report: any) => {
      const meta = report.report_data?.metadata || {};
      const locName = report.locations?.name || meta.location_name || "Unknown Location";
      const dateStr = report.assignments?.scheduled_date || meta.assignment_date || report.created_at;
      
      const finalizer = userMap[report.finalized_by];
      const finalizerName = finalizer ? (finalizer.name || finalizer.email) : "Unknown Client";

      let auditorName = "Unknown Auditor";
      const rawAuditors = report.assignments?.auditor_ids;
      let audIds: string[] = [];
      if (Array.isArray(rawAuditors)) audIds = rawAuditors;
      else if (typeof rawAuditors === 'string') audIds = [rawAuditors];
      
      if (audIds.length > 0) {
          const names = audIds.map(id => {
              const u = userMap[id];
              return u ? (u.name || u.email) : null;
          }).filter(Boolean);
          if (names.length > 0) auditorName = names.join(", ");
      }

      return {
        id: report.id,
        assignment_id: report.assignment_id, 
        finalized_at: report.created_at,
        finalized_by_name: finalizerName, 
        auditor_name: auditorName, 
        report_data: report.report_data,
        locations: { name: locName },
        assignments: { scheduled_date: dateStr }
      };
    });
  }

  public async getAuditors(): Promise<any[]> {
    const { data } = await supabase.from("user_profiles").select("*").in("role", ["auditor", "admin"]);
    return data || [];
  }

  public async getAuditorsByCompany(companyId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .in("role", ["auditor", "admin"])
      .contains("assigned_companies", [companyId]); 
      
    if (error) return [];
    return data || [];
  }

  public async getUploadHistory(companyId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("inventory_upload_history")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  public async hasClosingStockForAssignment(assignmentId: number): Promise<boolean> {
    const { count, error } = await supabase
      .from("inventory_upload_history")
      .select("*", { count: 'exact', head: true })
      .eq("assignment_id", assignmentId)
      .eq("upload_type", "closing_stock");

    if (error) throw error;
    return (count || 0) > 0;
  }

  public async logUploadBatch(params: any): Promise<void> {
     const { data: { user } } = await supabase.auth.getUser();
     const payload = {
       batch_key: params.batchKey,
       company_id: params.companyId,
       location_id: params.locationId || null, 
       location_name: params.locationName || "Unknown Location",
       upload_type: params.uploadType,
       total_items: params.totalItems,
       uploaded_by: user?.id || null,
       assignment_id: params.assignmentId || null 
     };
     await supabase.from("inventory_upload_history").insert(payload);
  }

  public async deleteUploadBatch(id: string): Promise<void> {
    const { data: history } = await supabase.from("inventory_upload_history").select("batch_key, company_id").eq("id", id).single();
    if (history) {
        await supabase.from("inventory_items").delete().eq("upload_batch_key", history.batch_key).eq("company_id", history.company_id);
    }
    const { error } = await supabase.from("inventory_upload_history").delete().eq("id", id);
    if (error) throw error;
  }

  public async clearInventoryData(companyId: string): Promise<void> {
     await supabase.from("inventory_items").delete().eq("company_id", companyId);
     await supabase.from("assignments").delete().eq("company_id", companyId);
  }

  public async deleteInventoryForLocation(companyId: string, locationName: string): Promise<void> {
    await supabase.from("inventory_items").delete()
      .eq("company_id", companyId)
      .eq("location", locationName);
  }

  public async getLocations() { const { data } = await supabase.from("locations").select("*").eq("active", true); return data?.map((l:any)=>({id:l.id,name:l.name,description:l.description,active:l.active,companyId:l.company_id,auditStatus:l.audit_status})) || []; }
  public async addLocation(l:any) { await supabase.from("locations").insert({name:l.name,description:l.description,company_id:l.companyId,active:true}); }
  public async updateLocation(l:any) { await supabase.from("locations").update(l).eq("id",l.id); }
  public async deleteLocation(id:string) { await supabase.from("locations").update({active:false} as any).eq("id",id); }
  public async getQuestions(cId:string) { const {data}=await supabase.from("questions").select("*").eq("company_id",cId); return data?.map((q:any)=>({...q, options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options, companyId: q.company_id})) || []; }
  public async addQuestion(q:any) { await supabase.from("questions").insert({text:q.text,type:q.type,required:q.required,options:q.options,company_id:q.companyId} as any); }
  public async updateQuestion(q:any) { await supabase.from("questions").update(q as any).eq("id",q.id); }
  public async deleteQuestion(id:string) { await supabase.from("questions").delete().eq("id",id); }
  
  public async getQuestionnaireAnswers(cId:string) { 
    const {data}=await supabase.from("questionnaire_answers").select("*").eq("company_id",cId); 
    return data?.map((a:any)=>({
      questionId:a.question_id,
      locationId:a.location_id,
      answer:a.answer,
      answeredBy:a.answered_by,
      answeredOn:a.answered_on,
      companyId:a.company_id,
      assignmentId: a.assignment_id 
    }))||[]; 
  }

  public async upsertQuestionnaireAnswer(a:any) { 
    await supabase.from("questionnaire_answers").upsert({
      question_id:a.questionId,
      location_id:a.locationId,
      company_id:a.companyId,
      answer:a.answer,
      answered_by:a.answeredBy,
      answered_on:a.answeredOn,
      assignment_id: a.assignmentId 
    } as any, {onConflict:'question_id,assignment_id' as any}); 
  }
  
  public async updateLocationAuditStatus(locationId: string, status: AuditStatus): Promise<void> {
    const { error } = await supabase
      .from("locations")
      .update({ audit_status: status } as any)
      .eq("id", locationId);
    if (error) throw error;
  }
}

export default new SupabaseDataService();