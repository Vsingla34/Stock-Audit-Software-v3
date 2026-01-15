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
  UploadCloud,
  FileSpreadsheet,
  Loader2,
  Download,
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
import { processCSV } from "@/components/upload/utils/csvUtils";

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
    deleteAssignment,
    setSelectedLocationFilter
  } = useInventory();
  
  const { currentUser } = useUser();
  const { selectedCompanyId, setSelectedCompanyId, setSelectedAssignmentId } = useCompany();
  
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

  // Import State
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyUuidMap, setCompanyUuidMap] = useState<Map<string, string>>(new Map());
  
  const [auditors, setAuditors] = useState<AuditorOption[]>([]);
  const [filteredAuditors, setFilteredAuditors] = useState<AuditorOption[]>([]);
  const [loadingAuditors, setLoadingAuditors] = useState(false);

  const [companyMap, setCompanyMap] = useState<Map<string, string>>(new Map());
  const [auditorMap, setAuditorMap] = useState<Map<string, string>>(new Map());

  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin = currentUser?.role === "admin";
  const isAuditor = currentUser?.role === "auditor";

  useEffect(() => {
    const fetchMetadata = async () => {
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

      const auditorData = await SupabaseDataService.getAuditors();
      setAuditors(auditorData);
      setAuditorMap(new Map(auditorData.map(a => [a.id, a.name])));
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
          
          setGlobalAssignments(fetchedAssignments);
          setGlobalLocations(fetchedLocations);
        } catch (e) {
          console.error("Error fetching global data", e);
        }
      }

      let relevantAssignments = activeAssignments;
      if (isAdmin && !isSuperAdmin) {
        relevantAssignments = activeAssignments.filter(a => currentUser?.assigned_companies?.includes(a.companyId));
      } else if (isAuditor) {
        relevantAssignments = activeAssignments.filter(a => {
          const ids = (a as any).auditorIds || (a.auditorId ? (a.auditorId as string).split(',') : []);
          return ids.includes(currentUser?.id);
        });
      }

      const newRows: AssignmentRow[] = relevantAssignments.map(a => {
        const loc = activeLocations.find(l => l.id === a.locationId);
        const companyName = companyMap.get(a.companyId) || "Unknown Company";
        const locationName = loc?.name || "Unknown Location";
        
        let auditorNames: string[] = [];
        const rawIds = (a as any).auditorIds 
          ? (a as any).auditorIds 
          : (a.auditorId ? (a.auditorId as string).split(',') : []);

        if (rawIds && rawIds.length > 0) {
          auditorNames = rawIds.map((id: string) => auditorMap.get(id.trim()) || "Unknown Auditor");
        } else {
          auditorNames = ["Unassigned"];
        }

        const dateStr = a.scheduledDate 
          ? format(new Date(a.scheduledDate), "MMM dd, yyyy") 
          : "-";

        return {
          dbId: a.id,
          id: a.id.toString().padStart(4, '0'),
          companyName: companyName,
          companyId: a.companyId,
          locationId: a.locationId,
          locationName: locationName,
          status: a.status,
          completionDate: dateStr,
          auditorNames: auditorNames
        };
      });

      setRows(newRows);
      setLoading(false);
    };

    loadAssignments();

  }, [
    selectedCompanyId, 
    contextAssignments, 
    contextLocations, 
    companyMap, 
    auditorMap, 
    isSuperAdmin, 
    isAdmin, 
    isAuditor, 
    currentUser
  ]);

  useEffect(() => {
    const fetchFilteredAuditors = async () => {
      if (!targetCompanyId) {
        setFilteredAuditors([]);
        return;
      }
      
      const companyUuid = companyUuidMap.get(targetCompanyId);
      if (!companyUuid) {
        setFilteredAuditors([]);
        return;
      }

      setLoadingAuditors(true);
      try {
        const data = await SupabaseDataService.getAuditorsByCompany(companyUuid);
        setFilteredAuditors(data);
      } catch (error) {
        toast.error("Could not load auditors for this company");
      } finally {
        setLoadingAuditors(false);
      }
    };

    fetchFilteredAuditors();
  }, [targetCompanyId, companyUuidMap]);

  const handleOpenDashboard = (row: AssignmentRow) => {
    setSelectedCompanyId(row.companyId);
    setSelectedAssignmentId(row.dbId);
    setSelectedLocationFilter(row.locationId);
    
    sessionStorage.setItem("selectedCompanyId", row.companyId);
    sessionStorage.setItem("selectedAssignmentId", row.dbId.toString());
    
    navigate("/");
  };

  // 1. INITIATE FINALIZATION (Send OTP)
  const handleInitiateFinalization = async (row: AssignmentRow) => {
    if (!confirm(`Are you sure you want to finalize the audit for ${row.locationName}? \n\nThis will trigger an email to the client for verification.`)) return;

    setVerificationPendingRow(row);
    setVerificationStatus("sending");
    setOtpCode("");

    try {
      toast.loading("Sending Verification Code to Client...");
      const message = await SupabaseDataService.sendAssignmentOtp(row.dbId);
      toast.dismiss();
      toast.success(message);
      
      setVerificationStatus("idle");
      setIsVerificationOpen(true);
    } catch (e: any) {
      toast.dismiss();
      toast.error(`Failed to send code: ${e.message}`);
      setVerificationStatus("idle");
      setVerificationPendingRow(null);
    }
  };

  // 2. CONFIRM FINALIZATION (Verify OTP & Execute)
  const handleConfirmFinalization = async () => {
    if (!verificationPendingRow) return;
    
    setVerificationStatus("verifying");
    
    try {
      const isValid = await SupabaseDataService.verifyAssignmentOtp(verificationPendingRow.dbId, otpCode);
      
      if (!isValid) {
        toast.error("Invalid Code. Please try again.");
        setVerificationStatus("idle");
        return;
      }

      // CODE IS VALID - PROCEED WITH FINALIZATION LOGIC
      await executeFinalization(verificationPendingRow);
      
      setIsVerificationOpen(false);
      setVerificationPendingRow(null);
      setOtpCode("");

    } catch (e: any) {
      toast.error(`Verification error: ${e.message}`);
      setVerificationStatus("idle");
    }
  };

  // 3. EXECUTE LOGIC (The heavy lifting)
  const executeFinalization = async (row: AssignmentRow) => {
    try {
      toast.loading("Generating final report...");

      // Fetch Latest Data
      const items = await SupabaseDataService.getItemMaster(row.companyId);
      const audited = await SupabaseDataService.getAuditedItems(row.companyId);
      const questionnaires = await SupabaseDataService.getQuestionnaireAnswers(row.companyId);

      // Filter by Location
      const locationItems = items.filter(i => i.location === row.locationName);
      const locationAuditedItems = audited.filter(i => i.location === row.locationName);
      
      const totalItems = locationItems.length;
      const auditedCount = locationItems.filter(masterItem => {
          const auditedItem = locationAuditedItems.find(a => a.id === masterItem.id);
          return auditedItem && auditedItem.status !== 'pending';
      }).length;
      
      let matched = 0;
      let discrepancies = 0;
      locationItems.forEach(masterItem => {
          const auditedItem = locationAuditedItems.find(a => a.id === masterItem.id);
          if (auditedItem && auditedItem.status !== 'pending') {
             if (auditedItem.status === 'matched') matched++;
             else if (auditedItem.status === 'discrepancy') discrepancies++;
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
          const auditedItem = locationAuditedItems.find(a => a.id === item.id);
          return {
            sku: item.sku,
            name: item.name,
            category: item.category,
            system_quantity: item.systemQuantity,
            physical_quantity: auditedItem?.physicalQuantity || 0,
            status: auditedItem?.status || 'pending',
            variance: (auditedItem?.physicalQuantity || 0) - item.systemQuantity,
            remarks: item.clientRemarks,
            auditor_entries: auditedItem?.auditorEntries
          };
        }),
        questionnaire: questionnaires.filter(a => a.locationId === row.locationId)
      };

      // Save Report
      await SupabaseDataService.createAuditReport({
        company_id: row.companyId,
        location_id: row.locationId,
        assignment_id: row.dbId,
        report_data: reportData,
        finalized_by: currentUser?.id,
        location_name: row.locationName,
        assignment_date: row.completionDate
      });

      // Clear Inventory
      await SupabaseDataService.deleteInventoryForLocation(row.companyId, row.locationName);

      // Update Status
      await SupabaseDataService.updateAssignment(row.dbId, { status: 'finalized' });
      
      // Refresh UI
      if (!selectedCompanyId) {
         setGlobalAssignments(prev => prev.map(a => a.id === row.dbId ? { ...a, status: 'finalized' } : a));
      } else {
         window.location.reload();
      }

      toast.dismiss();
      toast.success("Audit finalized successfully.");

    } catch (e: any) {
      console.error(e);
      toast.dismiss();
      toast.error(`Finalization failed: ${e.message}`);
    }
  };

  const handleOpenCreate = () => {
    setDialogMode("create");
    setTargetCompanyId(selectedCompanyId || ""); 
    setSelectedLocationId("");
    setSelectedStatus("pending");
    setSelectedDate(new Date().toISOString().split('T')[0]); 
    setSelectedAuditorIds([]);
    setIsDialogOpen(true);
  };

  const handleOpenModify = (row: AssignmentRow) => {
    setDialogMode("modify");
    setSelectedAssignmentIdState(row.dbId);
    
    const sourceList = selectedCompanyId ? contextAssignments : globalAssignments;
    const original = sourceList.find(a => a.id === row.dbId);
    
    if (original) {
      setTargetCompanyId(original.companyId);
      setSelectedLocationId(original.locationId);
      setSelectedStatus(original.status);
      setSelectedDate(original.scheduledDate ? new Date(original.scheduledDate).toISOString().split('T')[0] : "");
      
      const rawIds = (original as any).auditorIds 
        ? (original as any).auditorIds 
        : (original.auditorId ? (original.auditorId as string).split(',') : []);

      setSelectedAuditorIds(rawIds.map((id: string) => id.trim()));
    }
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this assignment?")) {
      try {
        await deleteAssignment(id);
        if (!selectedCompanyId) {
           setGlobalAssignments(prev => prev.filter(a => a.id !== id));
        }
        toast.success("Assignment deleted");
      } catch (e) {
        toast.error("Failed to delete assignment");
      }
    }
  };

  const handleSubmit = async () => {
    if (!targetCompanyId) return toast.error("Select a company");
    if (!selectedLocationId) return toast.error("Select a location");
    if (!selectedDate) return toast.error("Select a date");

    const finalAuditorIds = selectedAuditorIds;

    try {
      if (dialogMode === "create") {
        const newAssignment = await SupabaseDataService.createAssignment({
            locationId: selectedLocationId,
            companyId: targetCompanyId,
            status: selectedStatus,
            scheduledDate: selectedDate,
            auditorIds: finalAuditorIds
        });
        
        if (!selectedCompanyId) {
            setGlobalAssignments(prev => [newAssignment, ...prev]);
        }
        
        if (selectedCompanyId) {
           window.location.reload(); 
        }

        toast.success("Assignment created");
      } else {
        if (selectedAssignmentIdState) {
          if (selectedCompanyId) {
             await updateAssignment(selectedAssignmentIdState, selectedStatus, selectedDate, finalAuditorIds);
          } else {
             await SupabaseDataService.updateAssignment(selectedAssignmentIdState, {
                status: selectedStatus,
                scheduledDate: selectedDate,
                auditorIds: finalAuditorIds
             });
             setGlobalAssignments(prev => prev.map(a => 
                a.id === selectedAssignmentIdState 
                ? { ...a, status: selectedStatus, scheduledDate: selectedDate, auditorIds: finalAuditorIds } 
                : a
             ));
          }
          toast.success("Assignment updated");
        }
      }
      setIsDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Operation failed");
    }
  };

  const toggleAuditor = (auditorId: string) => {
    setSelectedAuditorIds(prev => {
      if (prev.includes(auditorId)) {
        return prev.filter(id => id !== auditorId);
      } else {
        return [...prev, auditorId];
      }
    });
  };

  const removeAuditor = (auditorId: string) => {
    setSelectedAuditorIds(prev => prev.filter(id => id !== auditorId));
  };

  // --- BULK IMPORT LOGIC ---

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const parseDate = (dateStr: string): string => {
    if (!dateStr) return new Date().toISOString();
    
    const ddmmyyyy = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10);
      const year = parseInt(ddmmyyyy[3], 10);
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    console.warn(`Invalid date format: ${dateStr}, defaulting to today.`);
    return new Date().toISOString();
  };

  const handleBulkImport = async () => {
    if (!importFile) {
      toast.error("Please select a file first.");
      return;
    }
    
    setIsImporting(true);

    try {
       const text = await importFile.text();
       const rows = processCSV(text);

       if (rows.length === 0) throw new Error("File is empty");

       let successCount = 0;
       let failCount = 0;
       
       for (const row of rows) {
          const companyName = row['company'] || row['company name'];
          const locationName = row['location'] || row['location name'] || row['store'];
          const auditorNamesStr = row['auditors'] || row['auditor'] || "";
          
          const rawDate = row['date'] || row['scheduled date'];
          const scheduledDate = parseDate(rawDate);
          
          const statusStr = row['status'] || "pending";

          if (!companyName || !locationName) {
             console.warn("Skipping row: missing company or location", row);
             failCount++;
             continue;
          }

          const company = companies.find(c => c.name.toLowerCase() === companyName.toLowerCase());
          if (!company) {
             console.warn(`Skipping row: Company '${companyName}' not found`);
             failCount++;
             continue;
          }

          const locs = globalLocations.length > 0 ? globalLocations : (contextLocations || []);
          const location = locs.find(l => 
             l.companyId === company.id && 
             l.name.toLowerCase() === locationName.toLowerCase()
          );

          if (!location) {
             console.warn(`Skipping row: Location '${locationName}' not found for company '${companyName}'`);
             failCount++;
             continue;
          }

          const auditorIds: string[] = [];
          if (auditorNamesStr) {
             const names = auditorNamesStr.split(/[;,|]+/).map((n: string) => n.trim().toLowerCase());
             auditors.forEach(a => {
                if (names.includes(a.name.toLowerCase()) || names.includes(a.email.toLowerCase())) {
                   auditorIds.push(a.id);
                }
             });
          }

          await SupabaseDataService.createAssignment({
             locationId: location.id,
             companyId: company.id,
             status: statusStr.toLowerCase() as AuditStatus,
             scheduledDate: scheduledDate,
             auditorIds: auditorIds
          });

          successCount++;
       }

       toast.success(`Import complete`, {
         description: `Created ${successCount} assignments. Failed/Skipped: ${failCount}`
       });
       
       setIsImportDialogOpen(false);
       setImportFile(null);
       window.location.reload();

    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Failed to process file", { description: error.message });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ["Company,Location,Auditors,Date,Status"];
    const example = ["My Company,Warehouse A,John Doe;Jane Smith,15-02-2026,pending"];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join("\n") + "\n" + example.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "assignment_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case "active": return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">Active</Badge>;
      case "submitted": return <Badge variant="secondary" className="bg-orange-100 text-orange-700">Review</Badge>;
      case "finalized": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const [dropdownLocations, setDropdownLocations] = useState<Location[]>([]);
  useEffect(() => {
     const loadLocs = async () => {
        if (!targetCompanyId) {
            setDropdownLocations([]);
            return;
        }
        if (targetCompanyId === selectedCompanyId) {
            setDropdownLocations(contextLocations);
            return;
        }
        const locs = await SupabaseDataService.getLocations(); 
        setDropdownLocations(locs.filter(l => l.companyId === targetCompanyId));
     }
     loadLocs();
  }, [targetCompanyId, selectedCompanyId, contextLocations]);


  const pageContent = (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {/* ADDED BACK BUTTON */}
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="p-0 hover:bg-transparent"
        >
          <ArrowLeft className="h-6 w-6 text-gray-500 hover:text-gray-900" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Assignments</h1>
          <p className="text-gray-500">Manage audit assignments across all companies.</p>
        </div>
        {(isSuperAdmin || isAdmin) && (
          <div className="flex gap-2">
            <Button onClick={() => setIsImportDialogOpen(true)} variant="outline" className="bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50">
              <UploadCloud className="mr-2 h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={handleOpenCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="mr-2 h-4 w-4" /> Create Assignment
            </Button>
          </div>
        )}
      </div>

      <Card className="shadow-sm border-gray-200">
        {/* ... Rest of the component remains the same ... */}
        <CardHeader className="bg-gray-50/50 border-b border-gray-100">
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <ClipboardList className="h-5 w-5 text-indigo-600" />
            All Assignments
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No assignments found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Assigned Auditors</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.dbId}>
                    <TableCell className="font-mono font-medium text-indigo-600">#{row.id}</TableCell>
                    <TableCell className="font-medium text-gray-900">{row.companyName}</TableCell>
                    <TableCell>{row.locationName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {row.auditorNames.map((name, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                            <UserCircle className="h-3 w-3 text-gray-400" />
                            <span className={name === "Unassigned" ? "text-gray-400 italic text-sm" : "text-gray-700 text-sm"}>
                              {name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600">{row.completionDate}</TableCell>
                    <TableCell>{getStatusBadge(row.status)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      
                      {/* FINALIZE BUTTON (With OTP) */}
                      {(isSuperAdmin || isAdmin) && row.status !== 'finalized' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleInitiateFinalization(row)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                          title="Generate Final Report"
                          disabled={verificationStatus === 'sending'}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Finalize
                        </Button>
                      )}

                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleOpenDashboard(row)}
                        className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" /> Open
                      </Button>

                      {(isSuperAdmin || isAdmin) && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handleOpenModify(row)}>
                            <Pencil className="h-4 w-4 text-gray-500 hover:text-indigo-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(row.dbId)}>
                            <Trash2 className="h-4 w-4 text-gray-500 hover:text-red-600" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* CREATE / MODIFY DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? 'Create Assignment' : 'Modify Assignment'}</DialogTitle>
            <DialogDescription>Set the location, auditors, status, and date for this audit.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            
            {(isSuperAdmin || (isAdmin && !selectedCompanyId)) && dialogMode === 'create' && (
              <div className="space-y-2">
                <Label>Company</Label>
                <Select 
                  value={targetCompanyId} 
                  onValueChange={(val) => {
                    setTargetCompanyId(val);
                    setSelectedLocationId("");
                  }}
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
            )}

            <div className="space-y-2">
              <Label>Location</Label>
              <Select 
                value={selectedLocationId} 
                onValueChange={setSelectedLocationId} 
                disabled={dialogMode === 'modify' || (!targetCompanyId && isSuperAdmin)} 
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Location" />
                </SelectTrigger>
                <SelectContent>
                  {dropdownLocations.length > 0 ? (
                    dropdownLocations.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No locations found for this company</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assigned Auditors (Select Multiple)</Label>
              
              {selectedAuditorIds.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-md border">
                  {selectedAuditorIds.map(auditorId => {
                    const auditor = filteredAuditors.find(a => a.id === auditorId);
                    return (
                      <Badge key={auditorId} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                        <UserCircle className="h-3 w-3" />
                        <span>{auditor?.name || "Unknown"}</span>
                        <button
                          onClick={() => removeAuditor(auditorId)}
                          className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}

              <div className="border rounded-md max-h-60 overflow-y-auto">
                {loadingAuditors ? (
                  <div className="p-4 text-center text-gray-500">Loading auditors...</div>
                ) : !targetCompanyId ? (
                  <div className="p-4 text-center text-gray-500">Select a company first</div>
                ) : filteredAuditors.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No auditors found for this company</div>
                ) : (
                  <div className="divide-y">
                    {filteredAuditors.map(auditor => (
                      <label
                        key={auditor.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedAuditorIds.includes(auditor.id)}
                          onCheckedChange={() => toggleAuditor(auditor.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{auditor.name}</div>
                          <div className="text-xs text-gray-500">{auditor.email}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={(val: AuditStatus) => setSelectedStatus(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="finalized">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              <Input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{dialogMode === 'create' ? 'Create' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VERIFICATION DIALOG */}
      <Dialog open={isVerificationOpen} onOpenChange={(open) => { if(!open) setIsVerificationOpen(false); }}>
         <DialogContent className="sm:max-w-md">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <Lock className="h-5 w-5 text-indigo-600" />
               Client Verification Required
             </DialogTitle>
             <DialogDescription>
               An email with a verification code has been sent to the registered client. 
               Please enter the code to finalize this audit.
             </DialogDescription>
           </DialogHeader>
           
           <div className="flex flex-col items-center justify-center space-y-4 py-4">
             <div className="bg-indigo-50 p-3 rounded-full">
               <Mail className="h-6 w-6 text-indigo-600" />
             </div>
             
             <div className="space-y-2 w-full flex justify-center">
               <InputOTP
                 maxLength={6}
                 value={otpCode}
                 onChange={(val) => setOtpCode(val)}
               >
                 <InputOTPGroup>
                   <InputOTPSlot index={0} />
                   <InputOTPSlot index={1} />
                   <InputOTPSlot index={2} />
                 </InputOTPGroup>
                 <div className="flex items-center justify-center mx-2">-</div>
                 <InputOTPGroup>
                   <InputOTPSlot index={3} />
                   <InputOTPSlot index={4} />
                   <InputOTPSlot index={5} />
                 </InputOTPGroup>
               </InputOTP>
             </div>
             <p className="text-xs text-gray-500">Check your email inbox or spam folder.</p>
           </div>

           <DialogFooter className="sm:justify-between">
             <Button variant="ghost" onClick={() => setIsVerificationOpen(false)}>Cancel</Button>
             <Button 
               onClick={handleConfirmFinalization} 
               disabled={otpCode.length !== 6 || verificationStatus === 'verifying'}
               className="bg-indigo-600 hover:bg-indigo-700"
             >
               {verificationStatus === 'verifying' ? 'Verifying...' : 'Verify & Finalize'}
             </Button>
           </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* IMPORT ASSIGNMENTS DIALOG */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-gray-900 flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-indigo-600" />
              Import Assignments
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Upload a CSV file to create assignments in bulk.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg space-y-2">
              <h4 className="text-sm font-medium text-indigo-900 flex items-center gap-2">
                 <FileSpreadsheet className="h-4 w-4" />
                 CSV Format Guide
              </h4>
              <p className="text-xs text-indigo-700">
                 Required: <code className="bg-white px-1 rounded">Company</code>, <code className="bg-white px-1 rounded">Location</code>
              </p>
              <p className="text-xs text-indigo-700">
                 Optional: <code className="bg-white px-1 rounded">Auditors</code> (semicolon separated), <code className="bg-white px-1 rounded">Date</code>, <code className="bg-white px-1 rounded">Status</code>
              </p>
              <Button 
                 variant="ghost" 
                 size="sm" 
                 onClick={downloadTemplate}
                 className="h-6 text-xs text-indigo-700 hover:bg-indigo-100 px-0 hover:px-2 transition-all"
              >
                 <Download className="h-3 w-3 mr-1" /> Download Template
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-upload">Select CSV File</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleImportFileChange}
                className="cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)} disabled={isImporting}>
              Cancel
            </Button>
            <Button onClick={handleBulkImport} disabled={!importFile || isImporting} className="bg-indigo-600 hover:bg-indigo-700">
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Start Import"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <AppLayout showSidebar={false}>
      {pageContent}
    </AppLayout>
  );
};

export default AssignmentPage;