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

  private mapDbRows(rows: any[]): InventoryItem[] {
    return rows.map((item: any) => {
      let parsedEntries = [];
      if (Array.isArray(item.auditor_entries)) {
        parsedEntries = item.auditor_entries;
      } else if (typeof item.auditor_entries === 'string') {
        try { parsedEntries = JSON.parse(item.auditor_entries); } catch { parsedEntries = []; }
      }

      let parsedCustomAttributes: any = {};
      if (item.custom_attributes && typeof item.custom_attributes === 'object') {
        parsedCustomAttributes = item.custom_attributes;
      } else if (typeof item.custom_attributes === 'string') {
        try { parsedCustomAttributes = JSON.parse(item.custom_attributes); } catch { parsedCustomAttributes = {}; }
      }

      let itemName = item.name;
      if (!itemName || itemName === "Unnamed Item") {
        const customName =
          parsedCustomAttributes['Name'] ||
          parsedCustomAttributes['name'] ||
          parsedCustomAttributes['Item Name'] ||
          parsedCustomAttributes['item_name'];
        itemName = customName || "Unnamed Item";
      }

      let itemCategory = item.category;
      if (!itemCategory || itemCategory === "-") {
        const customCategory =
          parsedCustomAttributes['Category'] ||
          parsedCustomAttributes['category'];
        if (customCategory) itemCategory = customCategory;
      }

      const reservedFields = [
        'sku', 'name', 'category', 'location', 'systemQuantity', 'physicalQuantity',
        'status', 'lastAudited', 'notes', 'clientRemarks', 'uploadBatchKey', 'assignmentId',
        'id', 'companyId', 'auditorEntries', 'item_name', 'itemname'
      ];
      const cleanedCustomAttributes: any = { ...parsedCustomAttributes };
      reservedFields.forEach(field => {
        delete cleanedCustomAttributes[field];
        delete cleanedCustomAttributes[field.toLowerCase()];
        delete cleanedCustomAttributes[field.toUpperCase()];
      });

      let unitPrice = 0;
      let measuringUnit = "";

      const priceKeywords    = ['unit price', 'price', 'rate', 'cost', 'mrp', 'unit cost', 'item value', 'value', 'unit_price'];
      const uglyValueKeywords = ['system value', 'system_value', 'physical value', 'physical_value', 'sys value', 'phy value', 'val var'];
      const uomKeywords       = ['measuring unit', 'unit', 'uom', 'measure unit'];

      Object.keys(cleanedCustomAttributes).forEach(key => {
        const lowerK = key.trim().toLowerCase();

        if (priceKeywords.includes(lowerK)) {
          if (unitPrice === 0) {
            const valStr = String(cleanedCustomAttributes[key]).replace(/[^0-9.-]+/g, "");
            unitPrice = parseFloat(valStr) || 0;
          }
          delete cleanedCustomAttributes[key];
        }

        if (uglyValueKeywords.includes(lowerK)) {
          delete cleanedCustomAttributes[key];
        }

        if (uomKeywords.includes(lowerK)) {
          if (!measuringUnit) {
            measuringUnit = String(cleanedCustomAttributes[key]).trim();
          }
          delete cleanedCustomAttributes[key];
        }
      });

      if (unitPrice > 0)    cleanedCustomAttributes['unit_price'] = unitPrice;
      if (measuringUnit)    cleanedCustomAttributes['Unit'] = measuringUnit;

      return {
        id: item.id,
        sku: item.sku,
        name: itemName,
        category: itemCategory,
        location: item.location,
        companyId: item.company_id,
        systemQuantity: parseFloat(item.system_quantity) || 0,
        physicalQuantity: parseFloat(item.physical_quantity) || 0,
        status: item.status as any,
        lastAudited: item.last_audited,
        notes: item.notes,
        auditorEntries: parsedEntries,
        clientRemarks: item.client_remarks,
        uploadBatchKey: item.upload_batch_key,
        assignmentId: item.assignment_id,
        customAttributes: cleanedCustomAttributes,
      };
    });
  }

  public async getSingleItem(itemId: string): Promise<InventoryItem | null> {
    // Fix 2.3: maybeSingle — item may not exist
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("id", itemId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return this.mapDbRows([data])[0];
  }

  public async uploadFile(file: File, path: string): Promise<string> {
    const { error } = await supabase.storage
      .from("audit-attachments")
      .upload(path, file, { upsert: true });

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
    if (companyId) query = query.eq("company_id", companyId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    return (data || []).map(item => {
      let audIds: string[] = [];
      if (Array.isArray(item.auditor_ids)) audIds = item.auditor_ids;
      else if (typeof item.auditor_ids === 'string') audIds = [item.auditor_ids];
      
      let cliIds: string[] = [];
      if (Array.isArray(item.client_ids)) cliIds = item.client_ids;
      else if (typeof item.client_ids === 'string') cliIds = [item.client_ids];

      return {
        id: item.id,
        locationId: item.location_id,
        companyId: item.company_id,
        auditorId: audIds.join(','),
        auditorIds: audIds,
        clientIds: cliIds,
        status: item.status as AuditStatus,
        scheduledDate: item.scheduled_date || item.created_at,
        showSystemQuantity: item.show_system_quantity ?? true,
      } as any;
    });
  }

  public async createAssignment(assignment: {
    locationId: string;
    companyId: string;
    status: AuditStatus;
    scheduledDate?: string;
    auditorIds?: string[];
    clientIds?: string[];
    showSystemQuantity?: boolean;
  }): Promise<Assignment> {
    const { data, error } = await supabase
      .from("assignments")
      .insert({
        location_id: assignment.locationId,
        company_id: assignment.companyId,
        status: assignment.status,
        scheduled_date: assignment.scheduledDate,
        auditor_ids: assignment.auditorIds || [],
        client_ids: assignment.clientIds || [], 
        show_system_quantity: assignment.showSystemQuantity !== false,
      })
      .select()
      .single();

    if (error) throw error;

    const audIds = Array.isArray(data.auditor_ids) ? data.auditor_ids : [];
    const cliIds = Array.isArray(data.client_ids) ? data.client_ids : [];
    
    return {
      id: data.id,
      locationId: data.location_id,
      companyId: data.company_id,
      auditorId: audIds.join(','),
      auditorIds: audIds,
      clientIds: cliIds,
      status: data.status as AuditStatus,
      scheduledDate: data.scheduled_date || data.created_at,
      showSystemQuantity: data.show_system_quantity ?? true,
    } as any;
  }

  public async updateAssignment(id: number, updates: {
    status?: AuditStatus;
    scheduledDate?: string;
    auditorIds?: string[];
    clientIds?: string[];
    showSystemQuantity?: boolean;
  }): Promise<void> {
    const payload: any = {};
    if (updates.status)        payload.status          = updates.status;
    if (updates.scheduledDate) payload.scheduled_date  = updates.scheduledDate;
    if (updates.auditorIds !== undefined) payload.auditor_ids = updates.auditorIds;
    if (updates.clientIds !== undefined) payload.client_ids = updates.clientIds;
    if (updates.showSystemQuantity !== undefined) payload.show_system_quantity = updates.showSystemQuantity;

    const { error } = await supabase.from("assignments").update(payload).eq("id", id);
    if (error) throw error;
  }

  public async deleteAssignment(id: number): Promise<void> {
    const { error: qaError } = await supabase.from("questionnaire_answers").delete().eq("assignment_id", id);
    if (qaError) throw qaError;

    const { error: uploadError } = await supabase.from("inventory_upload_history").delete().eq("assignment_id", id);
    if (uploadError) throw uploadError;

    const { error: reportError } = await supabase.from("audit_reports" as any).delete().eq("assignment_id", id);
    if (reportError) throw reportError;

    const { error: itemError } = await supabase.from("inventory_items").delete().eq("assignment_id", id);
    if (itemError) throw itemError;

    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) throw error;
  }

  public async sendAssignmentOtp(assignmentId: number): Promise<string> {
    // Fix 2.3: maybeSingle — assignment may not exist
    const { data: assignment, error: assignError } = await supabase
      .from("assignments")
      .select("company_id, client_ids")
      .eq("id", assignmentId)
      .maybeSingle();

    if (assignError) throw assignError;
    if (!assignment) throw new Error("Assignment not found");

    let targetEmail = "";

    if (assignment.client_ids && assignment.client_ids.length > 0) {
        const { data: assignedClients } = await supabase
            .from("user_profiles")
            .select("email")
            .in("id", assignment.client_ids);
        
        if (assignedClients && assignedClients.length > 0) {
            targetEmail = assignedClients[0].email;
        }
    }

    if (!targetEmail) {
        const { data: clients, error: clientError } = await supabase
          .from("user_profiles")
          .select("email")
          .eq("role", "client")
          .contains("assigned_companies", [assignment.company_id]);

        if (clientError) throw clientError;
        if (!clients || clients.length === 0) {
          throw new Error("No client account found associated with this assignment or company.");
        }
        targetEmail = clients[0].email;
    }

    // Fix 2.4: persist in sessionStorage so OTP survives a page refresh
    this.pendingVerificationEmail = targetEmail;
    sessionStorage.setItem('pendingVerificationEmail', targetEmail);

    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { shouldCreateUser: false },
    });

    if (error) throw error;
    return `Verification code sent to ${targetEmail}`;
  }

  public async verifyAssignmentOtp(assignmentId: number, otp: string): Promise<boolean> {
    // Fix 2.4: restore from sessionStorage if in-memory value was lost on refresh
    if (!this.pendingVerificationEmail) {
      this.pendingVerificationEmail = sessionStorage.getItem('pendingVerificationEmail');
    }
    if (!this.pendingVerificationEmail) {
      throw new Error("Session expired or invalid. Please resend code.");
    }

    // Fix 2.4: use import.meta.env (Vite) — process.env is undefined in browser
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase configuration missing for verification.");
    }

    const tempClient = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await tempClient.auth.verifyOtp({
      email: this.pendingVerificationEmail,
      token: otp,
      type: 'email',
    });

    if (error || !data.user) return false;

    this.pendingVerificationEmail = null;
    sessionStorage.removeItem('pendingVerificationEmail');
    return true;
  }

  public async getItemMaster(companyId: string, assignmentId: number | null = null): Promise<InventoryItem[]> {
    const allItems: any[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
      let query = supabase
        .from("inventory_items")
        .select("*")
        .eq("company_id", companyId);

      if (assignmentId) {
        query = query.eq("assignment_id", assignmentId);
      } else {
        query = query.is("assignment_id", null);
      }

      query = query.range(page * pageSize, (page + 1) * pageSize - 1);

      const { data, error } = await query;
      if (error) { console.error("Error fetching item master:", error); throw error; }
      if (!data || data.length === 0) break;

      allItems.push(...data);
      if (data.length < pageSize) break;
      page++;
    }

    return this.mapDbRows(allItems);
  }

  public async getAuditedItems(companyId: string, assignmentId: number | null = null): Promise<InventoryItem[]> {
    return this.getItemMaster(companyId, assignmentId);
  }

  public async updateItemAttributes(
    itemId: string,
    customAttributes: Record<string, any>,
    clientRemarks?: string
  ): Promise<void> {
    const { error } = await supabase.rpc('update_item_attributes', {
      p_item_id: itemId,
      p_custom_attributes: customAttributes,
      p_client_remarks: clientRemarks || null,
    });
    if (error) throw error;
  }

  public async getGlobalMasterItem(companyId: string, sku: string): Promise<any | null> {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("company_id", companyId)
      .is("assignment_id", null)
      .eq("sku", sku)
      .maybeSingle();

    if (error) { console.error("Error fetching global master item:", error); return null; }
    return data;
  }

  public async getAllSkus(companyId: string): Promise<Set<string>> {
    const allSkus = new Set<string>();
    let page = 0;
    const pageSize = 1000;

    while (true) {
      const start = page * pageSize;
      const { data, error } = await supabase
        .from("inventory_items")
        .select("sku")
        .eq("company_id", companyId)
        .is("assignment_id", null)
        .range(start, start + pageSize - 1);

      if (error) { console.error("Error fetching SKUs at page", page, error); throw error; }
      if (!data || data.length === 0) break;

      data.forEach(row => {
        if (row.sku) {
          const trimmed = row.sku.trim();
          if (trimmed) allSkus.add(trimmed);
        }
      });

      if (data.length < pageSize) break;
      page++;
    }

    return allSkus;
  }

  public async getSubLocations(locationId: string, query: string = ""): Promise<string[]> {
    let dbQuery = supabase.from("sub_locations").select("name").eq("location_id", locationId);
    if (query) dbQuery = dbQuery.ilike("name", `%${query}%`);
    dbQuery = query ? dbQuery.limit(50) : dbQuery.limit(20);

    const { data, error } = await dbQuery.order("name");
    if (error) { console.error("Error fetching sub-locations:", error); return []; }
    return data.map((item: any) => item.name);
  }

  public async createSubLocation(params: { name: string; locationId: string; companyId: string }): Promise<void> {
    const { error } = await supabase
      .from("sub_locations")
      .insert({ name: params.name, location_id: params.locationId, company_id: params.companyId })
      .select()
      .single();

    if (error && error.code !== '23505') {
      console.error("Error creating sub-location:", error);
      throw error;
    }
  }

  public async setItemMaster(items: Partial<InventoryItem>[], companyId: string): Promise<void> {
    if (items.length === 0) return;
    const CHUNK_SIZE = 500;

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const payload = chunk.map(item => ({
        sku: item.sku,
        name: item.name || "Unnamed Item",
        category: item.category,
        location: item.location,
        assignment_id: null,
        system_quantity: parseFloat(item.systemQuantity as any) || 0,
        physical_quantity: parseFloat(item.physical_quantity as any) || 0,
        status: item.status || 'pending',
        client_remarks: item.clientRemarks,
        auditor_entries: item.auditorEntries || [],
        upload_batch_key: item.uploadBatchKey,
        custom_attributes: item.customAttributes || {},
      }));

      // Build 01 extension: routed through bulk_upsert_inventory_items RPC
      // instead of a raw .upsert() — this suppresses per-row audit_log
      // writes for the whole chunk and logs one proportional summary row
      // instead. Same visible behaviour, no write amplification at scale.
      const { error } = await (supabase.rpc as any)("bulk_upsert_inventory_items", {
        p_items: payload,
        p_company_id: companyId,
        p_batch_key: chunk[0]?.uploadBatchKey || null,
      });

      if (error) throw error;
    }
  }

  public async setClosingStock(items: Partial<InventoryItem>[], companyId: string, assignmentId: string): Promise<void> {
    if (items.length === 0) return;
    const assignmentIdInt = parseInt(assignmentId, 10);
    const CHUNK_SIZE = 500;

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const payload = chunk.map(item => ({
        sku: item.sku,
        name: item.name || "Unnamed Item",
        category: item.category || "-",
        location: item.location,
        assignment_id: assignmentIdInt,
        system_quantity: parseFloat(item.systemQuantity as any) || 0,
        physical_quantity: 0,
        status: 'pending',
        upload_batch_key: item.uploadBatchKey,
        custom_attributes: item.customAttributes || {},
      }));

      // Build 01 extension: see setItemMaster above — same RPC, same
      // write-amplification protection. This is the path that matters
      // most for Build 02, since Tally closing-stock imports land here.
      const { error } = await (supabase.rpc as any)("bulk_upsert_inventory_items", {
        p_items: payload,
        p_company_id: companyId,
        p_batch_key: chunk[0]?.uploadBatchKey || null,
      });

      if (error) throw error;
    }
  }

  public async uploadPhysicalQuantityStock(params: {
    items: { sku: string; physicalQuantity: number }[];
    companyId: string;
    assignmentId: number;
    batchKey: string;
    userId: string;
    userName: string;
  }) {
    const { items, assignmentId, batchKey, userId, userName } = params;

    const { data: existingItems, error: fetchErr } = await supabase
      .from('inventory_items')
      // 🔥 FIX: Added name, category, and location to satisfy NOT NULL constraints during upsert
      .select('id, sku, name, category, location, physical_quantity, system_quantity, auditor_entries, company_id, assignment_id')
      .eq('assignment_id', assignmentId);

    if (fetchErr) throw fetchErr;

    const existingMap = new Map(existingItems?.map(i => [i.sku, i]) || []);
    const missingSkus: string[] = [];

    const updates = items.map(upd => {
      const existing = existingMap.get(upd.sku);
      if (!existing) {
        missingSkus.push(upd.sku);
        return null;
      }

      let entries = existing.auditor_entries;
      if (typeof entries === 'string') entries = JSON.parse(entries);
      if (!Array.isArray(entries)) entries = [];

      const newEntry = {
        auditorId: userId || 'unknown',
        auditorName: userName || 'System',
        quantityFound: upd.physicalQuantity,
        auditedAt: new Date().toISOString(),
        subLocation: `systemUpload:${upd.physicalQuantity}`,
        batchKey: batchKey 
      };

      entries.push(newEntry);

      const newQty = (parseFloat(existing.physical_quantity) || 0) + upd.physicalQuantity;
      const sysQty = parseFloat(existing.system_quantity) || 0;

      return {
        id: existing.id,
        company_id: existing.company_id,
        assignment_id: existing.assignment_id,
        sku: existing.sku,
        name: existing.name,             // 🔥 FIX: Pass existing name back
        category: existing.category,     // 🔥 FIX: Pass existing category back
        location: existing.location,     // 🔥 FIX: Pass existing location back
        system_quantity: existing.system_quantity,
        physical_quantity: newQty,
        status: newQty === sysQty ? 'matched' : 'discrepancy',
        auditor_entries: entries,
        last_audited: new Date().toISOString()
      };
    }).filter(Boolean);

    if (missingSkus.length > 0) {
      throw new Error(`Validation Failed: ${missingSkus.length} SKUs from your sheet were not found in this Assignment's Closing Stock.\nExample SKUs: ${missingSkus.slice(0,3).join(', ')}.\nEnsure the SKUs perfectly match.`);
    }

    const CHUNK_SIZE = 500;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from('inventory_items').upsert(chunk as any);
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
        custom_attributes: item.customAttributes || {},
      };
      if (item.id) payload.id = item.id;
      return payload;
    });

    const { error } = await supabase
      .from("inventory_items")
      .upsert(dbItems, { onConflict: 'company_id, assignment_id, sku' as any });

    if (error) throw error;
  }

  public async addSurplusItem(params: {
    item: { sku: string; name: string; category: string; physicalQuantity: number; subLocation?: string; customAttributes?: Record<string, any> };
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
      auditedAt: new Date().toISOString(),
      subLocation: item.subLocation || "General",
    };

    const { error } = await supabase.from("inventory_items").insert({
      company_id: companyId,
      assignment_id: assignmentId,
      sku: item.sku,
      name: item.name,
      category: item.category,
      location: locationName,
      system_quantity: 0,
      physical_quantity: item.physicalQuantity,
      status: 'discrepancy',
      client_remarks: "Added from Master / Surplus",
      auditor_entries: [auditorEntry],
      last_audited: new Date().toISOString(),
      custom_attributes: item.customAttributes || {},
    });

    if (error) throw error;
  }

 
  public async addBulkSurplusItems(params: {
    items: { sku: string; name: string; category: string; physicalQuantity: number; subLocation?: string; customAttributes?: Record<string, any> }[];
    companyId: string;
    assignmentId: number;
    locationName: string;
    batchKey: string; 
    userId?: string;
    userName?: string;
  }): Promise<void> {
    const { items, companyId, assignmentId, locationName, batchKey, userId, userName } = params;

    const rows = items.map(item => ({
      company_id: companyId,
      assignment_id: assignmentId,
      sku: item.sku,
      name: item.name,
      category: item.category,
      location: locationName,
      system_quantity: 0,
      physical_quantity: item.physicalQuantity,
      status: 'discrepancy',
      client_remarks: "Bulk added from Master / Surplus",
      upload_batch_key: batchKey, // 🔥 FIX: Bind the item to the upload history!
      auditor_entries: [{
        auditorId: userId || 'unknown',
        auditorName: userName || 'Unknown',
        quantityFound: item.physicalQuantity,
        auditedAt: new Date().toISOString(),
        subLocation: item.subLocation || "General",
        batchKey: batchKey // Tag the specific entry too
      }],
      last_audited: new Date().toISOString(),
      custom_attributes: item.customAttributes || {},
    }));

    const CHUNK_SIZE = 500;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from("inventory_items").insert(chunk);
      if (error) throw error;
    }
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

    if (assignmentId) query = query.eq("assignment_id", assignmentId);
    const { error } = await query;
    if (error) throw error;
  }

  public async createAuditReport(payload: any): Promise<void> {
    const finalReportData = {
      ...payload.report_data,
      metadata: {
        location_name: payload.location_name,
        assignment_date: payload.assignment_date,
        finalized_date: new Date().toISOString(),
      },
    };

    const { error } = await supabase.from("audit_reports" as any).insert({
      company_id: payload.company_id,
      location_id: payload.location_id,
      assignment_id: payload.assignment_id,
      report_data: finalReportData,
      finalized_by: payload.finalized_by,
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
      if (Array.isArray(rawAuditors)) rawAuditors.forEach((id: string) => userIds.add(id));
      else if (typeof rawAuditors === 'string') userIds.add(rawAuditors);
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
      const meta      = report.report_data?.metadata || {};
      const locName   = report.locations?.name || meta.location_name || "Unknown Location";
      const dateStr   = report.assignments?.scheduled_date || meta.assignment_date || report.created_at;
      const finalizer = userMap[report.finalized_by];
      const finalizerName = finalizer ? (finalizer.name || finalizer.email) : "Unknown Client";

      let auditorName = "Unknown Auditor";
      const rawAuditors = report.assignments?.auditor_ids;
      let audIds: string[] = [];
      if (Array.isArray(rawAuditors)) audIds = rawAuditors;
      else if (typeof rawAuditors === 'string') audIds = [rawAuditors];

      if (audIds.length > 0) {
        const names = audIds.map(id => { const u = userMap[id]; return u ? (u.name || u.email) : null; }).filter(Boolean);
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
        assignments: { scheduled_date: dateStr },
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
    await supabase.from("inventory_upload_history").insert({
      batch_key:     params.batchKey,
      company_id:    params.companyId,
      location_id:   params.locationId   || null,
      location_name: params.locationName || "Unknown Location",
      upload_type:   params.uploadType,
      total_items:   params.totalItems,
      uploaded_by:   user?.id            || null,
      assignment_id: params.assignmentId || null,
    });
  }

  public async deleteUploadBatch(id: string): Promise<void> {
    // Fix 2.3: maybeSingle — batch may have already been deleted
    const { data: history } = await supabase
      .from("inventory_upload_history")
      .select("batch_key, company_id, upload_type, assignment_id")
      .eq("id", id)
      .maybeSingle();

    if (!history) return;

    if (history.upload_type === 'physical_quantity') {
       const { data: items } = await supabase
         .from("inventory_items")
       
         .select("id, physical_quantity, system_quantity, auditor_entries, company_id, assignment_id, sku, name, category, location")
         .eq("assignment_id", history.assignment_id);

       const updates = (items || []).map(item => {
          let entries = item.auditor_entries;
          if (typeof entries === 'string') entries = JSON.parse(entries);
          if (!Array.isArray(entries)) entries = [];

          const hasBatch = entries.some((e: any) => e.batchKey === history.batch_key);
          if (!hasBatch) return null; 

          const keptEntries = entries.filter((e: any) => e.batchKey !== history.batch_key);
          
          const newQty = keptEntries.reduce((sum, e) => sum + (Number(e.quantityFound) || 0), 0);
          const sysQty = Number(item.system_quantity) || 0;

          return {
             id: item.id,
             company_id: item.company_id,
             assignment_id: item.assignment_id,
             sku: item.sku,
             name: item.name,             // 🔥 FIX: Pass existing name back
             category: item.category,     // 🔥 FIX: Pass existing category back
             location: item.location,     // 🔥 FIX: Pass existing location back
             system_quantity: item.system_quantity,
             physical_quantity: newQty,
             status: newQty === sysQty ? 'matched' : 'discrepancy',
             auditor_entries: keptEntries
          };
       }).filter(Boolean);

       if (updates.length > 0) {
          const CHUNK_SIZE = 500;
          for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
             const { error } = await supabase.from('inventory_items').upsert(updates.slice(i, i + CHUNK_SIZE) as any);
             if (error) throw error;
          }
       }
    } else {
       await supabase.from("inventory_items")
        .delete()
        .eq("upload_batch_key", history.batch_key)
        .eq("company_id", history.company_id);
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

  public async deleteInventoryItems(itemIds: string[]): Promise<void> {
    if (!itemIds || itemIds.length === 0) return;
    const CHUNK_SIZE = 500;
    for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
      const chunk = itemIds.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from('inventory_items').delete().in('id', chunk);
      if (error) throw error;
    }
  }

  public async getLocations() {
    const { data } = await supabase.from("locations").select("*").eq("active", true);
    return data?.map((l: any) => ({
      id: l.id, name: l.name, description: l.description,
      active: l.active, companyId: l.company_id, auditStatus: l.audit_status,
    })) || [];
  }

  public async addLocation(l: any) {
    await supabase.from("locations").insert({ name: l.name, description: l.description, company_id: l.companyId, active: true });
  }

  public async updateLocation(l: any) {
    await supabase.from("locations").update(l).eq("id", l.id);
  }

  public async deleteLocation(id: string) {
    await supabase.from("locations").update({ active: false } as any).eq("id", id);
  }

  public async getQuestions(cId: string) {
    const { data, error } = await supabase.from("questions").select("*").eq("company_id", cId);
    if (error) throw error;
    
    return data?.map((q: any) => ({
      id: q.id,
      text: q.text,
      type: q.type,
      required: q.required,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
      companyId: q.company_id,
    })) || [];
  }

  public async addQuestion(q: any) {
    const { error } = await supabase.from("questions").insert({ 
      text: q.text, 
      type: q.type, 
      required: q.required, 
      options: q.options, 
      company_id: q.companyId 
    });
    
    if (error) throw error;
  }

  public async updateQuestion(q: any) {
    const { error } = await supabase.from("questions").update({
      text: q.text,
      type: q.type,
      required: q.required,
      options: q.options,
      company_id: q.companyId
    }).eq("id", q.id);

    if (error) throw error;
  }

  public async deleteQuestion(id: string) {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) throw error;
  }

  public async getQuestionnaireAnswers(cId: string) {
    const { data } = await supabase.from("questionnaire_answers").select("*").eq("company_id", cId);
    return data?.map((a: any) => ({
      questionId:   a.question_id,
      locationId:   a.location_id,
      answer:       a.answer,
      answeredBy:   a.answered_by,
      answeredOn:   a.answered_on,
      companyId:    a.company_id,
      assignmentId: a.assignment_id,
    })) || [];
  }

  public async upsertQuestionnaireAnswer(a: any) {
    await supabase.from("questionnaire_answers").upsert({
      question_id:  a.questionId,
      location_id:  a.locationId,
      company_id:   a.companyId,
      answer:       a.answer,
      answered_by:  a.answeredBy,
      answered_on:  a.answeredOn,
      assignment_id: a.assignmentId,
    } as any, { onConflict: 'question_id,assignment_id' as any });
  }

  public async updateLocationAuditStatus(locationId: string, status: AuditStatus): Promise<void> {
    const { error } = await supabase
      .from("locations")
      .update({ audit_status: status } as any)
      .eq("id", locationId);
    if (error) throw error;
  }

  public async secureRecordScan(itemId: string, newEntry: any, quantityAdded: number): Promise<void> {
    const { error } = await supabase.rpc('record_scan', {
      p_item_id:        itemId,
      p_new_entry:      newEntry,
      p_quantity_added: quantityAdded,
    });

    if (error) {
      console.error("Database Atomic Update Failed:", error);
      throw new Error("Failed to record scan securely. Please try again.");
    }
  }

  public async getInventoryStats(companyId: string, assignmentId: number): Promise<any> {
    const { data, error } = await supabase.rpc('get_inventory_stats', {
      p_company_id:    companyId,
      p_assignment_id: assignmentId,
    });

    if (error) { console.error("Error fetching inventory stats:", error); return null; }
    return data;
  }

  // Fix 3.1: Server-side paginated search — replaces in-memory itemMaster.filter()
  public async searchInventoryItems(params: {
    companyId: string;
    assignmentId?: string | number | null;
    query: string;
    locationId?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<{ items: InventoryItem[]; hasMore: boolean }> {
    const { companyId, assignmentId, query, locationId, limit = 50, offset = 0 } = params;

    // Bug fix: a text query represents explicit user intent to find a
    // specific item by name/SKU/category. It must never be silently
    // narrowed by location — Supabase-js ANDs .eq() and .or() together,
    // so "ITEM1004" + a stale/mismatched locationId returned zero rows
    // even though the SKU matched exactly. Location is only a valid
    // filter when the user is browsing (no search text yet).
    const hasQuery = !!query && query.trim().length >= 2;

    let q = supabase
      .from("inventory_items")
      .select("*")
      .eq("company_id", companyId);

    if (assignmentId) q = q.eq("assignment_id", String(assignmentId));

    // Only scope by location when there's no active text search
    if (locationId && !hasQuery) q = q.eq("location_id", locationId);

    if (hasQuery) {
      const term = query.trim();
      q = q.or(`name.ilike.%${term}%,sku.ilike.%${term}%,category.ilike.%${term}%`);
    }

    // Fetch one extra row to know if there are more pages
    q = q.range(offset, offset + limit).order("sku");

    const { data, error } = await q;
    if (error) throw error;

    const rows = data || [];
    const hasMore = rows.length > limit;
    return {
      items: this.mapDbRows(hasMore ? rows.slice(0, limit) : rows),
      hasMore,
    };
  }

  // Build 01: Immutable audit trail reader
  public async getAuditLog(params: {
    companyId: string;
    assignmentId?: string | null;
    entityType?: string;
    entityId?: string;
    actorId?: string;
    action?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: AuditLogRow[]; total: number }> {
    const {
      companyId, assignmentId, entityType, entityId,
      actorId, action, from, to, limit = 50, offset = 0,
    } = params;

    let q = supabase
      .from("audit_log")
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .order("occurred_at", { ascending: false });

    if (assignmentId) q = q.eq("assignment_id", assignmentId);
    if (entityType)   q = q.eq("entity_type", entityType);
    if (entityId)     q = q.eq("entity_id", entityId);
    if (actorId)      q = q.eq("actor_id", actorId);
    if (action)       q = q.eq("action", action);
    if (from)         q = q.gte("occurred_at", from);
    if (to)           q = q.lte("occurred_at", to);

    q = q.range(offset, offset + limit - 1);

    const { data, error, count } = await q;
    if (error) throw error;

    return { rows: (data as unknown as AuditLogRow[]) || [], total: count || 0 };
  }

  // Convenience wrapper for the inline "History" popover on a single item
  public async getItemAuditLog(itemId: string, companyId: string): Promise<AuditLogRow[]> {
    const { rows } = await this.getAuditLog({
      companyId,
      entityType: "inventory_items",
      entityId: itemId,
      limit: 20,
    });
    return rows;
  }
} // end class SupabaseDataService

// Build 01: Audit log row shape. Add `as any` at call sites if types.ts
// hasn't been regenerated yet via the Supabase CLI (see Build 00 notes) —
// this interface is what getAuditLog() casts the raw response into either way.
export interface AuditLogRow {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  company_id: string | null;
  assignment_id: string | null;
  entity_type: string;
  entity_id: string;
  action: "insert" | "update" | "delete";
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  changed_fields: string[] | null;
}

export default new SupabaseDataService();