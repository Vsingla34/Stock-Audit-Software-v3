// src/pages/AddCompany.tsx — Redesign v2: technical console language
// (monospace ID chips, status pulse dots, left accent bars) matching
// CompanySelection and AssignmentSelection. All business logic — the
// careful foreign-key-ordered cascade delete especially — is untouched.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Save, Building2, Edit, Trash, Plus, ArrowLeft, LogOut } from "lucide-react"; 
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserAccess } from "@/hooks/useUserAccess"; 
import { useUser } from "@/context/UserContext"; 

interface Company {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

// Same muted palette function as CompanySelection, so a company's color
// identity stays consistent whether you're picking it or managing it.
const AVATAR_PALETTE = [
  { bg: "#F5F1FF", text: "#6E1FEB", ring: "#E3D6FF" },
  { bg: "#EEF6FF", text: "#1D6FE0", ring: "#CFE6FF" },
  { bg: "#FDF3E8", text: "#B4650F", ring: "#F5DEC0" },
  { bg: "#ECFAF3", text: "#0F8F5C", ring: "#C9F0DE" },
  { bg: "#FCF0F8", text: "#B01D89", ring: "#F4D3EA" },
  { bg: "#F0F2FE", text: "#4338CA", ring: "#DADEFB" },
];
function paletteFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const AddCompany = () => {
  const navigate = useNavigate();
  const { userRole } = useUserAccess(); 
  const { logout } = useUser();
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    is_active: true
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCompany = async () => {
    if (!formData.name.trim()) {
      toast.error("Company name is required");
      return;
    }

    try {
      const { error } = await supabase
        .from('companies')
        .insert([{
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          is_active: formData.is_active
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success("Company created successfully", {
        description: `${formData.name} has been added to the system.`
      });

      setFormData({ name: "", address: "", is_active: true });
      setIsAddDialogOpen(false);
      fetchCompanies();
    } catch (error: any) {
      console.error("Error creating company:", error);
      toast.error("Failed to create company", {
        description: error.message
      });
    }
  };

  const handleEditCompany = async () => {
    if (!selectedCompany || !formData.name.trim()) {
      toast.error("Company name is required");
      return;
    }

    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: formData.name.trim(),
          address: formData.address.trim() || null,
          is_active: formData.is_active
        })
        .eq('id', selectedCompany.id);

      if (error) throw error;

      toast.success("Company updated successfully");
      setIsEditDialogOpen(false);
      setSelectedCompany(null);
      fetchCompanies();
    } catch (error: any) {
      console.error("Error updating company:", error);
      toast.error("Failed to update company", {
        description: error.message
      });
    }
  };

  const handleDeleteCompany = async () => {
    if (!selectedCompany) return;

    try {
      // 1. Check for associated data
      const { count: itemCount } = await supabase
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id);

      const { count: locationCount } = await supabase
        .from('locations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id);

      // Just checking if data exists, but we rely on Super Admin role to force delete
      const hasAssociatedData = (itemCount || 0) > 0 || (locationCount || 0) > 0;

      if (hasAssociatedData) {
        if (userRole !== "super_admin") {
          toast.error("Cannot delete company", {
            description: "This company has associated inventory items or locations. Please remove them first."
          });
          return;
        }

        toast.info("Deleting associated data...", { duration: 2000 });

        // --- ORDER IS IMPORTANT TO PREVENT FOREIGN KEY CONSTRAINTS ---

        // 1. Delete Audit Reports (Dependent on Assignments & Companies)
        await supabase.from('audit_reports' as any).delete().eq('company_id', selectedCompany.id);

        // 2. Delete Inventory Items (Dependent on Assignments & Companies)
        await supabase.from('inventory_items').delete().eq('company_id', selectedCompany.id);

        // 3. Delete Upload History (Dependent on Companies)
        await supabase.from('inventory_upload_history').delete().eq('company_id', selectedCompany.id);
        
        // 4. Delete Questionnaire Answers (Dependent on Assignments & Locations)
        // (We can delete by company_id directly if the column exists, otherwise via locations)
        await supabase.from('questionnaire_answers').delete().eq('company_id', selectedCompany.id);

        // 5. Delete Assignments (FIX: This was missing and caused the error!)
        await supabase.from('assignments').delete().eq('company_id', selectedCompany.id);

        // 6. Delete Questions (Dependent on Companies)
        await supabase.from('questions').delete().eq('company_id', selectedCompany.id);

        // 7. Delete Locations (Assignments are gone, so now this is safe)
        await supabase.from('locations').delete().eq('company_id', selectedCompany.id);
      }

      // 8. Finally delete the Company
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', selectedCompany.id);

      if (error) throw error;

      toast.success("Company deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedCompany(null);
      fetchCompanies();
    } catch (error: any) {
      console.error("Error deleting company:", error);
      toast.error("Failed to delete company", {
        description: error.message
      });
    }
  };

  const openAddDialog = () => {
    setFormData({ name: "", address: "", is_active: true });
    setIsAddDialogOpen(true);
  };

  const openEditDialog = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      address: company.address || "",
      is_active: company.is_active
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (company: Company) => {
    setSelectedCompany(company);
    setIsDeleteDialogOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-space-50">
        <div className="text-center">
          <div className="h-9 w-9 rounded-full border-[3px] border-violet-200 border-t-violet-600 animate-spin mx-auto mb-4" />
          <p className="text-space-400 text-[13px] font-medium">Loading companies…</p>
        </div>
      </div>
    );
  }

  // Standalone Layout (No AppLayout/Sidebar)
  return (
    <div className="min-h-screen bg-space-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section with Back Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-space-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-1">
               <Button 
                 variant="ghost" 
                 size="sm" 
                 className="p-0 h-auto hover:bg-transparent text-space-400 hover:text-violet-600"
                 onClick={() => navigate("/company-selection")}
               >
                 <ArrowLeft className="h-4 w-4 mr-1" />
                 Back to Selection
               </Button>
            </div>
            <p className="section-label">Admin console</p>
            <h1 className="text-3xl font-bold tracking-tight text-space-900">Company Management</h1>
            <p className="text-space-500 text-[14px] font-medium">Manage companies and their information</p>
          </div>

          <div className="flex items-center gap-3">
             <Button 
                onClick={openAddDialog} 
                className="text-white shadow-glow-sm hover:shadow-glow hover:-translate-y-0.5 transition-all duration-200"
                style={{ background: "linear-gradient(135deg, #8338FF 0%, #6E1FEB 60%, #D0219A 100%)" }}
             >
                <Plus className="mr-2 h-4 w-4" />
                Add Company
             </Button>
             
             <Button 
               variant="ghost" 
               onClick={handleLogout}
               className="text-space-500 hover:text-rose-600 hover:bg-rose-50"
             >
               <LogOut className="h-4 w-4 mr-2" />
               Log out
             </Button>
          </div>
        </div>

        {/* ── Technical console table ── */}
        <div className="rounded-xl border border-space-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 bg-space-50 border-b border-space-200">
            <Building2 className="h-4 w-4 text-violet-500" />
            <span className="text-[13px] font-bold text-space-800">Companies</span>
            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 ml-1">
              {companies.length}
            </span>
          </div>

          {companies.length === 0 ? (
            <div className="text-center py-16 text-space-400">
              <Building2 className="h-10 w-10 mx-auto mb-4 opacity-20" />
              <p className="text-[13px] font-medium">No companies found. Create your first company to get started.</p>
            </div>
          ) : (
            <>
              {/* Column header row */}
              <div className="hidden md:grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-space-50/60 border-b border-space-200">
                <span className="text-[10px] font-bold uppercase tracking-widest text-space-400 font-mono">Company</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-space-400 font-mono">Address</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-space-400 font-mono w-20">Status</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-space-400 font-mono w-24">Created</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-space-400 font-mono w-16 text-right">Actions</span>
              </div>

              <div className="divide-y divide-space-100">
                {companies.map((company) => {
                  const p = paletteFor(company.name);
                  const shortId = company.id.replace(/-/g, "").slice(0, 8);
                  return (
                    <div
                      key={company.id}
                      className="group relative grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto_auto] items-center gap-2 md:gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-violet-50/30"
                    >
                      {/* Left accent bar */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-[3px] transition-all duration-200 group-hover:w-1"
                        style={{ backgroundColor: company.is_active ? p.ring : "#E2E8F0" }}
                      />

                      {/* Company + system ID */}
                      <div className="flex items-center gap-3 min-w-0 pl-2">
                        <div
                          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: p.bg, border: `1px solid ${p.ring}` }}
                        >
                          <span className="text-[11px] font-bold font-mono" style={{ color: p.text }}>
                            {getInitials(company.name)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[14px] font-bold text-space-900 tracking-tight truncate">{company.name}</p>
                          <span className="text-[10px] font-mono text-space-400">#{shortId}</span>
                        </div>
                      </div>

                      {/* Address */}
                      <p className="text-[13px] text-space-500 truncate pl-11 md:pl-0">
                        {company.address || "—"}
                      </p>

                      {/* Status — pulse dot for active, static for inactive */}
                      <div className="flex items-center gap-1.5 pl-11 md:pl-0">
                        {company.is_active ? (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full h-1.5 w-1.5 bg-space-300" />
                        )}
                        <span className={`text-[10px] font-mono font-semibold uppercase tracking-wide ${company.is_active ? "text-emerald-600" : "text-space-400"}`}>
                          {company.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {/* Created date */}
                      <p className="text-[12px] text-space-400 font-mono pl-11 md:pl-0">
                        {new Date(company.created_at).toLocaleDateString()}
                      </p>

                      {/* Actions */}
                      <div className="flex items-center gap-1 pl-11 md:pl-0 md:justify-end">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => openEditDialog(company)}
                          className="h-8 w-8 hover:bg-violet-50 hover:text-violet-600 transition-colors"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => openDeleteDialog(company)}
                          className="h-8 w-8 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash className="h-3.5 w-3.5 text-space-400" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Add Company Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-space-900">Add New Company</DialogTitle>
              <DialogDescription className="text-space-500">Enter the company details below.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-name" className="text-space-700">Company Name *</Label>
                <Input
                  id="add-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter company name"
                  className="focus-visible:ring-violet-500 border-space-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-address" className="text-space-700">Address</Label>
                <Textarea
                  id="add-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter company address"
                  className="focus-visible:ring-violet-500 border-space-200"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="add-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  className="data-[state=checked]:bg-violet-600"
                />
                <Label htmlFor="add-active" className="text-space-700 font-normal">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="border-space-200 text-space-700">Cancel</Button>
              <Button
                onClick={handleAddCompany}
                className="text-white shadow-glow-sm"
                style={{ background: "linear-gradient(135deg, #8338FF 0%, #6E1FEB 60%, #D0219A 100%)" }}
              >
                <Save className="mr-2 h-4 w-4" />
                Add Company
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Company Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-space-900">Edit Company</DialogTitle>
              <DialogDescription className="text-space-500">Update the company details below.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-space-700">Company Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="focus-visible:ring-violet-500 border-space-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address" className="text-space-700">Address</Label>
                <Textarea
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="focus-visible:ring-violet-500 border-space-200"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  className="data-[state=checked]:bg-violet-600"
                />
                <Label htmlFor="edit-active" className="text-space-700 font-normal">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="border-space-200 text-space-700">Cancel</Button>
              <Button
                onClick={handleEditCompany}
                className="text-white shadow-glow-sm"
                style={{ background: "linear-gradient(135deg, #8338FF 0%, #6E1FEB 60%, #D0219A 100%)" }}
              >
                <Save className="mr-2 h-4 w-4" />
                Update Company
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Company Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-600">Delete Company</DialogTitle>
              <DialogDescription className="text-space-500">
                Are you sure you want to delete "{selectedCompany?.name}"? 
                {userRole === "super_admin" 
                  ? " This will PERMANENTLY DELETE all locations, inventory items, and audit data associated with this company."
                  : " This action cannot be undone."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="border-space-200 text-space-700">Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteCompany} className="bg-red-600 hover:bg-red-700 text-white">
                {userRole === "super_admin" ? "Force Delete" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AddCompany;