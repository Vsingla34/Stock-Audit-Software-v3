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

  // ---------------------------------------------------------------------------
  // ASSIGNMENTS
  // ---------------------------------------------------------------------------

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
    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  // --- OTP LOGIC (Supabase Auth Based) ---

  public async sendAssignmentOtp(assignmentId: number): Promise<string> {
    // 1. Get Company ID from Assignment
    const { data: assignment, error: assignError } = await supabase
      .from("assignments")
      .select("company_id")
      .eq("id", assignmentId)
      .single();

    if (assignError || !assignment) throw new Error("Assignment not found");

    // 2. Find a Client for this Company
    // We look for a user profile with role 'client' who is assigned to this company
    const { data: clients, error: clientError } = await supabase
      .from("user_profiles")
      .select("email")
      .eq("role", "client")
      .contains("assigned_companies", [assignment.company_id]);

    if (clientError) throw clientError;

    if (!clients || clients.length === 0) {
      throw new Error("No client account found associated with this company.");
    }

    // Pick the first client found
    const targetEmail = clients[0].email;
    this.pendingVerificationEmail = targetEmail;

    // 3. Trigger Supabase Auth OTP (Standard Login Code)
    // This sends the standard "Your login code is XXXXXX" email
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        shouldCreateUser: false, // Only allow existing users
      }
    });

    if (error) throw error;

    return `Verification code sent to ${targetEmail}`;
  }

  public async verifyAssignmentOtp(assignmentId: number, otp: string): Promise<boolean> {
    if (!this.pendingVerificationEmail) {
      throw new Error("Session expired or invalid. Please resend code.");
    }

    // 4. Verify WITHOUT switching session
    // We create a temporary client instance so that verifying the OTP 
    // doesn't log the Auditor out and the Client in on this browser.
    
    // NOTE: This assumes Supabase URL/Key are available in the env or existing client
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

    // Verification successful (The OTP was valid for that email)
    this.pendingVerificationEmail = null;
    return true;
  }

  // ---------------------------------------------------------------------------
  // INVENTORY ITEMS
  // ---------------------------------------------------------------------------

  public async getItemMaster(companyId: string, assignmentId: number | null = null): Promise<InventoryItem[]> {
    let query = supabase
      .from("inventory_items")
      .select("*")
      .eq("company_id", companyId);

    if (assignmentId) {
       query = query.or(`assignment_id.eq.${assignmentId},assignment_id.is.null`);
    } else {
       query = query.is("assignment_id", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching item master:", error);
      throw error;
    }

    return (data || []).map((item: any) => {
      let parsedEntries = [];
      if (Array.isArray(item.auditor_entries)) {
        parsedEntries = item.auditor_entries;
      } else if (typeof item.auditor_entries === 'string') {
        try { parsedEntries = JSON.parse(item.auditor_entries); } catch { parsedEntries = []; }
      }

      return {
        id: item.id,
        sku: item.sku,
        name: item.name || "Unnamed Item", 
        category: item.category,
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
        assignmentId: item.assignment_id 
      };
    });
  }

  public async getAuditedItems(companyId: string, assignmentId: number | null = null): Promise<InventoryItem[]> {
    return this.getItemMaster(companyId, assignmentId);
  }

  public async setItemMaster(items: Partial<InventoryItem>[], companyId: string): Promise<void> {
    if (items.length === 0) return;
    
    const dbItems = items.map(item => ({
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
      upload_batch_key: item.uploadBatchKey 
    }));

    const { error } = await supabase
      .from("inventory_items")
      .upsert(dbItems as any, { onConflict: 'company_id, assignment_id, sku' as any }); 

    if (error) throw error;
  }

  public async setClosingStock(items: Partial<InventoryItem>[], companyId: string, assignmentId: string): Promise<void> {
     if (items.length === 0) return;
     
     const dbItems = items.map(item => ({
       sku: item.sku,
       name: item.name || "Unnamed Item", 
       category: item.category,
       location: item.location,
       company_id: companyId,
       assignment_id: parseInt(assignmentId), 
       system_quantity: item.systemQuantity,
       physical_quantity: 0, 
       status: 'pending',
       upload_batch_key: item.uploadBatchKey 
     }));

     const { error } = await supabase
       .from("inventory_items")
       .upsert(dbItems as any, { onConflict: 'company_id, assignment_id, sku' as any });

     if (error) throw error;
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
        notes: item.notes
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

    // Collect user IDs for resolution (Both Finalizers and Auditors)
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

      // Resolve Auditor Name(s) from Assignment
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
        assignment_id: report.assignment_id, // ADDED THIS
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

  // --- HELPER METHODS ---
  
  public async getLocations() { const { data } = await supabase.from("locations").select("*").eq("active", true); return data?.map((l:any)=>({id:l.id,name:l.name,description:l.description,active:l.active,companyId:l.company_id,auditStatus:l.audit_status})) || []; }
  public async addLocation(l:any) { await supabase.from("locations").insert({name:l.name,description:l.description,company_id:l.companyId,active:true}); }
  public async updateLocation(l:any) { await supabase.from("locations").update(l).eq("id",l.id); }
  public async deleteLocation(id:string) { await supabase.from("locations").update({active:false} as any).eq("id",id); }
  public async getQuestions(cId:string) { const {data}=await supabase.from("questions").select("*").eq("company_id",cId); return data?.map((q:any)=>({...q, options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options, companyId: q.company_id})) || []; }
  public async addQuestion(q:any) { await supabase.from("questions").insert({text:q.text,type:q.type,required:q.required,options:q.options,company_id:q.companyId} as any); }
  public async updateQuestion(q:any) { await supabase.from("questions").update(q as any).eq("id",q.id); }
  public async deleteQuestion(id:string) { await supabase.from("questions").delete().eq("id",id); }
  public async getQuestionnaireAnswers(cId:string) { const {data}=await supabase.from("questionnaire_answers").select("*").eq("company_id",cId); return data?.map((a:any)=>({questionId:a.question_id,locationId:a.location_id,answer:a.answer,answeredBy:a.answered_by,answeredOn:a.answered_on,companyId:a.company_id}))||[]; }
  public async upsertQuestionnaireAnswer(a:any) { await supabase.from("questionnaire_answers").upsert({question_id:a.questionId,location_id:a.locationId,company_id:a.companyId,answer:a.answer,answered_by:a.answeredBy,answered_on:a.answeredOn} as any, {onConflict:'question_id,location_id' as any}); }
  
  public async updateLocationAuditStatus(locationId: string, status: AuditStatus): Promise<void> {
    const { error } = await supabase
      .from("locations")
      .update({ audit_status: status } as any)
      .eq("id", locationId);
    if (error) throw error;
  }
}

export default new SupabaseDataService();