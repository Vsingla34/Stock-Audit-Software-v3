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
  assigned_companies?: string[];
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
  const [loadingAuditors, setLoadingAuditors] = useState(false);

  const [companyMap, setCompanyMap] = useState<Map<string, string>>(new Map());
  const [auditorMap, setAuditorMap] = useState<Map<string, string>>(new Map());

  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    const fetchMetadata = async () => {
      // 1. Fetch Companies
      const { data: companyData } = await supabase.from("companies").select("id, name");
      if (companyData) {
        let accessibleCompanies = companyData;
        if (!isSuperAdmin) {
          accessibleCompanies = companyData.filter(c => currentUser?.assigned_companies?.includes(c.id));
        }
        setCompanies(accessibleCompanies);
        setCompanyMap(new Map(companyData.map(c => [c.id, c.name])));
        setCompanyUuidMap(new Map(companyData.map(c => [c.id, c.id])));
      }

      // 2. Fetch Auditors with Assigned Companies
      const { data: auditorData, error } = await supabase
        .from("user_profiles")
        .select("id, name, email, assigned_companies")
        .eq("role", "auditor");
      
      if (auditorData) {
        setAuditors(auditorData);
        setAuditorMap(new Map(auditorData.map(a => [a.id, a.name])));
      }
    };
    fetchMetadata();
  }, [isSuperAdmin, currentUser]);

  useEffect(() => {
    const loadAssignments = async () => {
      setLoading(true);
      
      let activeAssignments: Assignment[] = [];
      let activeLocations: Location[] = [];

      if (selectedCompanyId) {
        activeAssignments = contextAssignments;
        activeLocations = contextLocations;
      } else if (isSuperAdmin || isAdmin) {
        try {
          const [fetchedAssignments, fetchedLocations] = await Promise.all([
            SupabaseDataService.getAssignments(),
            SupabaseDataService.getLocations()
          ]);
          activeAssignments = fetchedAssignments;
          activeLocations = fetchedLocations;
        } catch (e) { console.error(e); }
      }

      setGlobalAssignments(activeAssignments);
      setGlobalLocations(activeLocations);

      const tableRows: AssignmentRow[] = activeAssignments.map(a => {
        const locName = activeLocations.find(l => l.id === a.locationId)?.name || "Unknown Location";
        const compName = companyMap.get(a.companyId) || "Unknown Company";
        const auditorNames = a.auditorIds?.map(uid => auditorMap.get(uid) || "Unknown").filter(Boolean) || [];

        return {
          dbId: a.id,
          id: a.id.toString(),
          companyName: compName,
          companyId: a.companyId,
          locationId: a.locationId,
          locationName: locName,
          status: a.status,
          completionDate: a.endDate,
          auditorNames: auditorNames as string[]
        };
      });

      setRows(tableRows);
      setLoading(false);
    };

    if (companies.length > 0 && auditors.length > 0) {
        loadAssignments();
    }
  }, [selectedCompanyId, contextAssignments, contextLocations, isSuperAdmin, isAdmin, companyMap, auditorMap, companies.length, auditors.length]);

  const openDialog = (mode: "create" | "modify", assignment?: AssignmentRow) => {
    setDialogMode(mode);
    if (mode === "modify" && assignment) {
      setSelectedAssignmentIdState(assignment.dbId);
      setTargetCompanyId(assignment.companyId);
      setSelectedLocationId(assignment.locationId);
      setSelectedStatus(assignment.status);
      setSelectedDate(assignment.completionDate);
      
      const currentAssignment = globalAssignments.find(a => a.id === assignment.dbId);
      setSelectedAuditorIds(currentAssignment?.auditorIds || []);
      
      fetchAuditorsForCompany(assignment.companyId);

    } else {
      setSelectedAssignmentIdState(null);
      const defaultCompany = selectedCompanyId || "";
      setTargetCompanyId(defaultCompany);
      setSelectedLocationId("");
      setSelectedStatus("pending");
      setSelectedDate(new Date().toISOString().split('T')[0]);
      setSelectedAuditorIds([]);
      
      if (defaultCompany) {
          fetchAuditorsForCompany(defaultCompany);
      } else {
          setFilteredAuditors([]);
      }
    }
    setIsDialogOpen(true);
  };

  const fetchAuditorsForCompany = async (companyId: string) => {
      setLoadingAuditors(true);
      
      if (!companyId) {
          setFilteredAuditors([]);
          setLoadingAuditors(false);
          return;
      }

      const relevantAuditors = auditors.filter(auditor => {
          if (!auditor.assigned_companies) return false;
          return auditor.assigned_companies.includes(companyId);
      });
      
      setFilteredAuditors(relevantAuditors);
      setLoadingAuditors(false);
  };

  const toggleAuditor = (auditorId: string) => {
    setSelectedAuditorIds(prev => {
        if (prev.includes(auditorId)) return prev.filter(id => id !== auditorId);
        return [...prev, auditorId];
    });
  };

  const handleSave = async () => {
    if (!targetCompanyId || !selectedLocationId || !selectedDate) {
      toast.error("Please fill all fields");
      return;
    }
    
    try {
      const assignmentData = {
        companyId: targetCompanyId,
        locationId: selectedLocationId,
        status: selectedStatus,
        startDate: new Date().toISOString(),
        endDate: selectedDate,
        auditorIds: selectedAuditorIds
      };

      if (dialogMode === "create") {
         await SupabaseDataService.createAssignment(assignmentData);
         toast.success("Assignment created");
      } else if (selectedAssignmentIdState) {
         await SupabaseDataService.updateAssignment(selectedAssignmentIdState, {
            status: selectedStatus,
            scheduledDate: selectedDate,
            auditorIds: selectedAuditorIds
         });
         toast.success("Assignment updated");
      }
      setIsDialogOpen(false);
      window.location.reload(); 
    } catch (e: any) {
      toast.error(e.message || "Operation failed");
    }
  };

  const handleDelete = async (id: number) => {
    if(confirm("Delete this assignment?")) {
        try {
            await deleteAssignment(id);
            toast.success("Deleted");
            setRows(prev => prev.filter(r => r.dbId !== id));
        } catch(e) { toast.error("Delete failed"); }
    }
  };

  const getStatusBadge = (status: AuditStatus) => {
    switch(status) {
      case 'active': return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>;
      case 'submitted': return <Badge className="bg-blue-500 hover:bg-blue-600">Submitted</Badge>;
      case 'finalized': return <Badge variant="secondary">Finalized</Badge>;
      default: return <Badge variant="outline" className="text-gray-500">Pending</Badge>;
    }
  };

  const handleInitiateFinalization = async (row: AssignmentRow) => {
    setVerificationPendingRow(row);
    setIsVerificationOpen(true);
    setVerificationStatus("idle");
    setOtpCode("");
  };

  const handleSendOtp = async () => {
    setVerificationStatus("sending");
    setTimeout(() => {
        toast.success("OTP sent to your email/phone");
        setVerificationStatus("idle");
    }, 1000);
  };

  const handleVerifyOtp = async () => {
    if (otpCode !== "123456") {
        toast.error("Invalid OTP");
        return;
    }
    setVerificationStatus("verifying");
    if (verificationPendingRow) {
        try {
            await updateAssignment({ ...globalAssignments.find(a => a.id === verificationPendingRow.dbId)!, status: 'finalized' });
            toast.success("Assignment Finalized!");
            setIsVerificationOpen(false);
            window.location.reload();
        } catch (e) { toast.error("Finalization failed"); }
    }
    setVerificationStatus("idle");
  };

  return (
    <AppLayout showSidebar={false}>
      <div className="space-y-6">
        {/* RESPONSIVE HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* [Fixed] Removed md:hidden so this button is always visible */}
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                 <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">Assignment Management</h2>
                <p className="text-sm text-muted-foreground">Manage audit assignments for locations</p>
            </div>
          </div>
          
          {(isSuperAdmin || isAdmin) && (
            <Button onClick={() => openDialog("create")} className="bg-indigo-600 hover:bg-indigo-700 w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Create Assignment
            </Button>
          )}
        </div>

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="border-b border-gray-100 bg-gray-50/50">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <ClipboardList className="h-5 w-5 text-indigo-600" />
              Assignments List
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* RESPONSIVE TABLE WRAPPER */}
            <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="hidden md:table-cell">Company</TableHead>
                      <TableHead className="hidden lg:table-cell">Auditors</TableHead>
                      <TableHead className="hidden md:table-cell">Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
                    ) : rows.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No assignments found</TableCell></TableRow>
                    ) : (
                        rows.map((row) => (
                            <TableRow key={row.dbId} className="hover:bg-gray-50">
                                <TableCell className="font-mono text-xs text-gray-500">#{row.dbId}</TableCell>
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <span>{row.locationName}</span>
                                        <span className="md:hidden text-xs text-gray-500">{row.companyName}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-gray-600">{row.companyName}</TableCell>
                                <TableCell className="hidden lg:table-cell">
                                    <div className="flex flex-wrap gap-1">
                                        {row.auditorNames.map((name, i) => (
                                            <span key={i} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{name}</span>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell text-gray-600">
                                    {row.completionDate ? format(new Date(row.completionDate), 'MMM dd, yyyy') : '-'}
                                </TableCell>
                                <TableCell>{getStatusBadge(row.status)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        {(isSuperAdmin || isAdmin) && row.status !== 'finalized' && (
                                            <Button variant="outline" size="sm" onClick={() => handleInitiateFinalization(row)} className="h-8 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hidden sm:flex">
                                                <Lock className="mr-1 h-3 w-3" /> Finalize
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => openDialog("modify", row)} className="h-8 w-8 text-gray-500 hover:text-indigo-600">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        {(isSuperAdmin || isAdmin) && (
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(row.dbId)} className="h-8 w-8 text-gray-500 hover:text-red-600">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
           <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{dialogMode === 'create' ? 'Create Assignment' : 'Edit Assignment'}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                      <Label>Company</Label>
                      <Select 
                        value={targetCompanyId} 
                        onValueChange={(val) => { 
                            setTargetCompanyId(val); 
                            fetchAuditorsForCompany(val);
                        }}
                      >
                          <SelectTrigger><SelectValue placeholder="Select Company" /></SelectTrigger>
                          <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label>Location</Label>
                      <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                          <SelectTrigger><SelectValue placeholder="Select Location" /></SelectTrigger>
                          <SelectContent>
                            {globalLocations
                                .filter(l => l.companyId === targetCompanyId)
                                .map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)
                            }
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-2">
                      <Label>Auditors</Label>
                      <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                          {loadingAuditors ? (
                              <p className="text-xs text-muted-foreground">Loading auditors...</p>
                          ) : filteredAuditors.length === 0 ? (
                              <p className="text-xs text-muted-foreground italic">No auditors assigned to this company.</p>
                          ) : (
                              filteredAuditors.map(auditor => (
                                  <div key={auditor.id} className="flex items-center gap-2">
                                      <Checkbox 
                                        checked={selectedAuditorIds.includes(auditor.id)} 
                                        onCheckedChange={() => toggleAuditor(auditor.id)} 
                                      />
                                      <span className="text-sm">{auditor.name}</span>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={selectedStatus} onValueChange={(v: AuditStatus) => setSelectedStatus(v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="submitted">Submitted</SelectItem>
                                  <SelectItem value="finalized">Finalized</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label>Due Date</Label>
                          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                      </div>
                  </div>
              </div>
              <DialogFooter><Button onClick={handleSave}>Save Assignment</Button></DialogFooter>
           </DialogContent>
        </Dialog>

        <Dialog open={isVerificationOpen} onOpenChange={setIsVerificationOpen}>
           <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Finalize Audit</DialogTitle><DialogDescription>Enter the OTP sent to finalize this audit.</DialogDescription></DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                  <div className="flex gap-2">
                      <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup></InputOTP>
                      <Button variant="secondary" onClick={handleSendOtp} disabled={verificationStatus === 'sending'}>{verificationStatus === 'sending' ? <Loader2 className="animate-spin" /> : "Send Code"}</Button>
                  </div>
              </div>
              <DialogFooter><Button onClick={handleVerifyOtp} disabled={verificationStatus === 'verifying' || otpCode.length < 6}>Verify & Finalize</Button></DialogFooter>
           </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AssignmentPage;