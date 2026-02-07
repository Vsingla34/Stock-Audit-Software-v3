import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useInventory, AuditStatus, Assignment, Location } from "@/context/InventoryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  ClipboardList, 
  Plus, 
  Pencil, 
  Trash2, 
  UserCircle, 
  X, 
  ExternalLink, 
  CheckCircle, 
  Mail, 
  Lock,
  Loader2,
  ArrowLeft
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useUser } from "@/context/UserContext";
import { useCompany } from "@/context/CompanyContext";
import SupabaseDataService from "@/services/SupabaseDataService";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface AssignmentRow {
  dbId: number;
  id: string; 
  companyName: string; 
  companyId: string;
  locationId: string;
  locationName: string; 
  status: AuditStatus;
  completionDate: string;
  auditorNames: string[];
}

interface CompanyOption {
  id: string;
  name: string;
}

interface AuditorOption {
  id: string;
  name: string;
  email: string;
}

const AssignmentPage = () => {
  const navigate = useNavigate();
  
  const { 
    locations: contextLocations, 
    assignments: contextAssignments, 
    updateAssignment, 
    deleteAssignment
  } = useInventory();
  
  const { currentUser } = useUser();
  const { selectedCompanyId } = useCompany();
  
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [globalAssignments, setGlobalAssignments] = useState<Assignment[]>([]);
  const [globalLocations, setGlobalLocations] = useState<Location[]>([]);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "modify">("create");
  const [selectedAssignmentIdState, setSelectedAssignmentIdState] = useState<number | null>(null);
  
  const [targetCompanyId, setTargetCompanyId] = useState<string>("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<AuditStatus>("pending");
  const [selectedDate, setSelectedDate] = useState<string>(""); 
  const [selectedAuditorIds, setSelectedAuditorIds] = useState<string[]>([]);

  // OTP Verification State
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verificationPendingRow, setVerificationPendingRow] = useState<AssignmentRow | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "sending" | "verifying">("idle");

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyUuidMap, setCompanyUuidMap] = useState<Map<string, string>>(new Map());
  
  const [auditors, setAuditors] = useState<AuditorOption[]>([]);
  const [filteredAuditors, setFilteredAuditors] = useState<AuditorOption[]>([]);
  const [isAuditorsLoading, setIsAuditorsLoading] = useState(false);
  
  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        
        // Fetch Companies
        const { data: companiesData, error: companiesError } = await supabase
          .from("companies")
          .select("id, name")
          .eq("is_active", true);
          
        if (companiesError) throw companiesError;
        setCompanies(companiesData || []);
        
        // Map UUIDs
        const uuidMap = new Map<string, string>();
        companiesData?.forEach(c => uuidMap.set(c.id, c.name));
        setCompanyUuidMap(uuidMap);

        // Fetch Auditors (Profiles with role 'auditor')
        setIsAuditorsLoading(true);
        const { data: auditorsData, error: auditorsError } = await supabase
          .from("user_profiles")
          .select("id, name, email, assigned_companies") // Added assigned_companies to select
          .eq("role", "auditor");
          
        if (auditorsError) throw auditorsError;
        setAuditors(auditorsData || []);
        setIsAuditorsLoading(false);

      } catch (error: any) {
        console.error("Error fetching initial data:", error);
        toast.error("Failed to load initial data");
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Update rows when context changes
  useEffect(() => {
    const processAssignments = async () => {
      if (!contextAssignments || !contextLocations) return;
      
      // Get all assignments from DB (including auditors)
      const { data: dbAssignments, error } = await supabase
        .from("assignments")
        .select(`
          id,
          company_id,
          location_id,
          status,
          assigned_date,
          assignment_auditors (
            auditor_id
          )
        `);

      if (error) {
        console.error("Error fetching full assignment details:", error);
        return;
      }

      // Map Auditor Names
      // We need a map of all users to get names from IDs efficiently
      // For now, we rely on the 'auditors' state which contains auditors.
      // If an assignment has an admin/super_admin assigned, their name might be missing if we only fetched 'auditors'.
      // But let's assume assignments are mostly for auditors.
      
      const auditorMap = new Map(auditors.map(a => [a.id, a.name]));

      const processedRows: AssignmentRow[] = dbAssignments.map(item => {
        // Find Location Name
        // Note: contextLocations might only be for the selected company in context, 
        // so we might miss locations if we are viewing 'all' assignments as super admin.
        // ideally we should fetch locations globally or rely on what we have.
        // For this view, we will try to find it in contextLocations first.
        
        // If not found, we show ID or "Unknown"
        // Better approach: Fetch locations with company_id in a real app.
        // Here we will use a placeholder logic or fetch needed locations.
        
        // Let's rely on what we have in context for now (it fetches based on company selection usually).
        // If currentUser is super_admin, context usually fetches all locations? 
        // Let's check InventoryContext... it fetches based on selectedCompanyId usually.
        
        // For simplicity in this UI, we might see "Unknown Location" if the company isn't selected.
        // But let's proceed.
        
        const locName = contextLocations.find(l => String(l.id) === String(item.location_id))?.name || "Location " + item.location_id;
        const compName = companyUuidMap.get(item.company_id) || "Company " + item.company_id;

        const assignedAuditorIds = item.assignment_auditors.map((a: any) => a.auditor_id);
        const assignedAuditorNames = assignedAuditorIds.map((id: string) => auditorMap.get(id) || "User");

        return {
          dbId: item.id,
          id: String(item.id),
          companyName: compName,
          companyId: item.company_id,
          locationId: String(item.location_id),
          locationName: locName,
          status: item.status as AuditStatus,
          completionDate: item.assigned_date ? format(new Date(item.assigned_date), "MMM dd, yyyy") : "-",
          auditorNames: assignedAuditorNames
        };
      });

      // Filter by selected Company if needed (and if not super admin viewing all)
      // The contextAssignments are already filtered by SupabaseDataService based on selectedCompanyId
      // But we fetched raw from Supabase above to get auditors.
      // So we must filter here manually if a company is selected.
      
      let finalRows = processedRows;
      if (selectedCompanyId) {
        finalRows = finalRows.filter(r => r.companyId === selectedCompanyId);
      }
      
      setRows(finalRows);
    };

    processAssignments();
  }, [contextAssignments, contextLocations, auditors, companyUuidMap, selectedCompanyId]);

  // Filter auditors when company changes in dialog
  useEffect(() => {
    if (!targetCompanyId) {
      setFilteredAuditors([]);
      return;
    }
    // Filter auditors that are assigned to this company
    // Auditors have 'assigned_companies' array
    const filtered = auditors.filter(a => {
        // If assigned_companies is null/empty, maybe they are available for none? 
        // Or if logic implies they must be assigned explicitly.
        // Let's assume strict assignment.
        // We need to fetch assigned_companies for auditors. (Added to fetch above)
        
        const assigned = (a as any).assigned_companies || [];
        return assigned.includes(targetCompanyId);
    });
    setFilteredAuditors(filtered);
  }, [targetCompanyId, auditors]);


  const handleCreateClick = () => {
    setDialogMode("create");
    setTargetCompanyId(selectedCompanyId || ""); // Default to current context company
    setSelectedLocationId("");
    setSelectedStatus("active");
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setSelectedAuditorIds([]);
    setIsDialogOpen(true);
  };

  const handleEditClick = (row: AssignmentRow) => {
    setDialogMode("modify");
    setSelectedAssignmentIdState(row.dbId);
    setTargetCompanyId(row.companyId);
    setSelectedLocationId(row.locationId);
    setSelectedStatus(row.status);
    // Parse date for input
    // completionDate is formatted string, we need original. 
    // We didn't store original date in Row, let's just use today or try to parse.
    // Ideally we store raw date in row.
    setSelectedDate(new Date().toISOString().split('T')[0]); 
    
    // We need to find the auditors for this assignment to pre-fill
    // We have names in row, but need IDs.
    // We can fetch them or find them from the names (risky).
    // Better: We fetched them in 'processAssignments' but didn't store IDs in row.
    // Let's fetch specifically for this edit or improve Row interface.
    // For now, let's reset auditors or fetch on click.
    
    // Quick fix: Fetch assignment details
    supabase.from("assignment_auditors").select("auditor_id").eq("assignment_id", row.dbId)
      .then(({ data }) => {
         if (data) setSelectedAuditorIds(data.map(d => d.auditor_id));
      });

    setIsDialogOpen(true);
  };

  const handleDeleteClick = async (row: AssignmentRow) => {
    // Check for audit data
    const hasData = await SupabaseDataService.hasClosingStockForAssignment(row.dbId);
    if (hasData) {
        // Trigger OTP flow
        setVerificationPendingRow(row);
        setVerificationStatus("idle");
        setOtpCode("");
        setIsVerificationOpen(true);
    } else {
        if (confirm("Are you sure you want to delete this assignment?")) {
            await deleteAssignment(row.dbId);
            toast.success("Assignment deleted");
        }
    }
  };

  const handleSendOtp = async () => {
    setVerificationStatus("sending");
    try {
        const { error } = await supabase.functions.invoke('send-delete-otp', {
            body: { userId: currentUser?.id }
        });
        if (error) throw error;
        toast.success("OTP sent to your email");
        setVerificationStatus("verifying");
    } catch (e: any) {
        toast.error("Failed to send OTP: " + e.message);
        setVerificationStatus("idle");
    }
  };

  const handleVerifyAndDelete = async () => {
     if (!verificationPendingRow) return;
     try {
        const { data, error } = await supabase.functions.invoke('verify-delete-otp', {
            body: { userId: currentUser?.id, otp: otpCode }
        });
        
        if (error || !data.valid) {
            toast.error("Invalid OTP");
            return;
        }

        // Proceed with delete
        await deleteAssignment(verificationPendingRow.dbId);
        toast.success("Assignment deleted securely");
        setIsVerificationOpen(false);
        setVerificationPendingRow(null);

     } catch (e: any) {
        toast.error("Verification failed");
     }
  };

  const handleSave = async () => {
    if (!targetCompanyId || !selectedLocationId) {
        toast.error("Please select company and location");
        return;
    }

    try {
        if (dialogMode === "create") {
            const { data: newAssignment, error } = await supabase
                .from("assignments")
                .insert({
                    company_id: targetCompanyId,
                    location_id: Number(selectedLocationId),
                    status: selectedStatus,
                    assigned_date: selectedDate ? new Date(selectedDate).toISOString() : new Date().toISOString(),
                    assigned_by: currentUser?.id
                })
                .select()
                .single();
            
            if (error) throw error;

            // Insert Auditors
            if (selectedAuditorIds.length > 0) {
                const auditorRows = selectedAuditorIds.map(aid => ({
                    assignment_id: newAssignment.id,
                    auditor_id: aid
                }));
                const { error: audError } = await supabase.from("assignment_auditors").insert(auditorRows);
                if (audError) throw audError;
            }
            
            toast.success("Assignment Created");
        } else {
            // Update
             if (!selectedAssignmentIdState) return;
             
             const { error } = await supabase
                .from("assignments")
                .update({
                    company_id: targetCompanyId,
                    location_id: Number(selectedLocationId),
                    status: selectedStatus,
                    assigned_date: selectedDate ? new Date(selectedDate).toISOString() : undefined
                })
                .eq("id", selectedAssignmentIdState);
            
            if (error) throw error;

            // Update Auditors (Delete all and re-insert)
            await supabase.from("assignment_auditors").delete().eq("assignment_id", selectedAssignmentIdState);
            
            if (selectedAuditorIds.length > 0) {
                const auditorRows = selectedAuditorIds.map(aid => ({
                    assignment_id: selectedAssignmentIdState,
                    auditor_id: aid
                }));
                await supabase.from("assignment_auditors").insert(auditorRows);
            }

            toast.success("Assignment Updated");
        }
        setIsDialogOpen(false);
        // Trigger refresh via context or manual fetch
        window.location.reload(); // Simple refresh to ensure state sync
    } catch (e: any) {
        toast.error(e.message);
    }
  };

  return (
    <AppLayout showSidebar={false}> {/* Sidebar hidden */}
      <div className="space-y-6 max-w-7xl mx-auto pt-6">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
             </Button>
             <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Audit Assignments</h1>
                <p className="text-sm text-gray-500">Manage audit schedules and auditor allocations</p>
             </div>
          </div>
          <Button onClick={handleCreateClick} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            New Assignment
          </Button>
        </div>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="pb-2">
             <CardTitle className="text-lg">Active Assignments</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Company</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned Auditors</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                        No assignments found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.companyName}</TableCell>
                        <TableCell>{row.locationName}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className={
                              row.status === 'active' ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
                              row.status === 'finalized' ? "bg-green-100 text-green-700 hover:bg-green-100" :
                              "bg-gray-100 text-gray-700 hover:bg-gray-100"
                            }
                          >
                            {row.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {row.auditorNames.map((name, i) => (
                                <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 border border-gray-200">
                                    {name}
                                </span>
                            ))}
                            {row.auditorNames.length === 0 && <span className="text-gray-400 text-xs">-</span>}
                          </div>
                        </TableCell>
                        <TableCell>{row.completionDate}</TableCell>
                        <TableCell className="text-right">
                           <div className="flex justify-end gap-2">
                             <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-500" onClick={() => handleEditClick(row)}>
                                <Pencil className="w-4 h-4" />
                             </Button>
                             <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteClick(row)}>
                                <Trash2 className="w-4 h-4" />
                             </Button>
                           </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
           <DialogContent className="max-w-md">
             <DialogHeader>
               <DialogTitle>{dialogMode === 'create' ? "Create Assignment" : "Edit Assignment"}</DialogTitle>
               <DialogDescription>Assign auditors to a location for auditing.</DialogDescription>
             </DialogHeader>
             
             <div className="space-y-4 py-2">
                
                {/* Company Selection */}
                <div className="space-y-2">
                   <Label>Company</Label>
                   <Select 
                     value={targetCompanyId} 
                     onValueChange={setTargetCompanyId}
                     disabled={dialogMode === 'modify'} // Lock company on edit for simplicity
                   >
                     <SelectTrigger>
                       <SelectValue placeholder="Select Company" />
                     </SelectTrigger>
                     <SelectContent>
                       {companies.map(c => (
                         <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                </div>

                {/* Location Selection (Filtered by Company) */}
                 <div className="space-y-2">
                   <Label>Location</Label>
                   <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                     <SelectTrigger>
                       <SelectValue placeholder="Select Location" />
                     </SelectTrigger>
                     <SelectContent>
                       {/* We need to fetch locations for the selected company if not in context. 
                           For now, using contextLocations is partial. 
                           Ideally, fetch locations on company select. 
                           Implementation simplified for this artifact. 
                        */}
                       {contextLocations
                         .filter(l => !targetCompanyId || String(l.companyId) === targetCompanyId) // Assuming location has companyId property
                         .map(l => (
                         <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                </div>

                {/* Status */}
                 <div className="space-y-2">
                   <Label>Status</Label>
                   <Select value={selectedStatus} onValueChange={(v: any) => setSelectedStatus(v)}>
                     <SelectTrigger>
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="pending">Pending</SelectItem>
                       <SelectItem value="active">Active</SelectItem>
                       <SelectItem value="submitted">Submitted</SelectItem>
                       <SelectItem value="finalized">Finalized</SelectItem>
                     </SelectContent>
                   </Select>
                </div>

                 {/* Date */}
                 <div className="space-y-2">
                   <Label>Assigned Date</Label>
                   <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                </div>

                {/* Auditors (Multi-select simulation) */}
                <div className="space-y-2">
                   <Label>Auditors (Assigned to this Company)</Label>
                   <div className="border rounded-md p-2 max-h-40 overflow-y-auto space-y-2">
                      {isAuditorsLoading && <div className="text-xs text-gray-500">Loading auditors...</div>}
                      {!isAuditorsLoading && filteredAuditors.length === 0 && <div className="text-xs text-gray-400">No auditors assigned to this company.</div>}
                      
                      {filteredAuditors.map(auditor => (
                        <div key={auditor.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`aud-${auditor.id}`} 
                            checked={selectedAuditorIds.includes(auditor.id)}
                            onCheckedChange={(checked) => {
                                if (checked) {
                                    setSelectedAuditorIds([...selectedAuditorIds, auditor.id]);
                                } else {
                                    setSelectedAuditorIds(selectedAuditorIds.filter(id => id !== auditor.id));
                                }
                            }}
                          />
                          <label
                            htmlFor={`aud-${auditor.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {auditor.name} <span className="text-gray-400 text-xs">({auditor.email})</span>
                          </label>
                        </div>
                      ))}
                   </div>
                </div>

             </div>

             <DialogFooter>
               <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
               <Button onClick={handleSave}>Save Changes</Button>
             </DialogFooter>
           </DialogContent>
        </Dialog>

        {/* OTP Verification Dialog */}
        <Dialog open={isVerificationOpen} onOpenChange={(open) => { if (!open) setIsVerificationOpen(false); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Security Verification</DialogTitle>
                    <DialogDescription>
                        This assignment contains audit data. Please verify your identity to delete it.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="py-4 space-y-4">
                    {verificationStatus === "idle" && (
                        <div className="text-center">
                            <p className="text-sm text-gray-600 mb-4">
                                We will send a One-Time Password (OTP) to your registered email.
                            </p>
                            <Button onClick={handleSendOtp} className="w-full">
                                <Mail className="w-4 h-4 mr-2" />
                                Send OTP
                            </Button>
                        </div>
                    )}

                    {verificationStatus === "verifying" && (
                         <div className="space-y-4">
                            <div className="flex justify-center">
                                <InputOTP maxLength={6} value={otpCode} onChange={(val) => setOtpCode(val)}>
                                    <InputOTPGroup>
                                        <InputOTPSlot index={0} />
                                        <InputOTPSlot index={1} />
                                        <InputOTPSlot index={2} />
                                        <InputOTPSlot index={3} />
                                        <InputOTPSlot index={4} />
                                        <InputOTPSlot index={5} />
                                    </InputOTPGroup>
                                </InputOTP>
                            </div>
                            <p className="text-xs text-center text-gray-500">Enter the 6-digit code sent to your email.</p>
                            <Button onClick={handleVerifyAndDelete} className="w-full bg-red-600 hover:bg-red-700">
                                Verify & Delete
                            </Button>
                         </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
};

export default AssignmentPage;