import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, Building2, Edit, Trash, Plus, ArrowLeft, LogOut } from "lucide-react"; 
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useUserAccess } from "@/hooks/useUserAccess"; 
import { useUser } from "@/context/UserContext"; 

interface Company {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading companies...</p>
        </div>
      </div>
    );
  }

  // Standalone Layout (No AppLayout/Sidebar)
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section with Back Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
               <Button 
                 variant="ghost" 
                 size="sm" 
                 className="p-0 h-auto hover:bg-transparent text-gray-500 hover:text-indigo-600"
                 onClick={() => navigate("/company-selection")}
               >
                 <ArrowLeft className="h-4 w-4 mr-1" />
                 Back to Selection
               </Button>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Company Management</h1>
            <p className="text-gray-500 text-lg">Manage companies and their information</p>
          </div>

          <div className="flex items-center gap-3">
             <Button 
                onClick={openAddDialog} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all"
             >
                <Plus className="mr-2 h-4 w-4" />
                Add Company
             </Button>
             
             <Button 
               variant="ghost" 
               onClick={handleLogout}
               className="text-gray-500 hover:text-red-600 hover:bg-red-50"
             >
               <LogOut className="h-4 w-4 mr-2" />
               Log out
             </Button>
          </div>
        </div>

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Building2 className="h-5 w-5 text-indigo-600" />
              Companies ({companies.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {companies.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No companies found. Create your first company to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="font-semibold text-gray-700">Company Name</TableHead>
                    <TableHead className="font-semibold text-gray-700">Address</TableHead>
                    <TableHead className="font-semibold text-gray-700">Status</TableHead>
                    <TableHead className="font-semibold text-gray-700">Created</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id} className="hover:bg-gray-50/50 transition-colors border-gray-100">
                      <TableCell className="font-medium text-gray-900">{company.name}</TableCell>
                      <TableCell className="text-gray-600">{company.address || "—"}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={company.is_active 
                            ? "bg-green-50 text-green-700 border-green-200" 
                            : "bg-gray-100 text-gray-600 border-gray-200"}
                        >
                          {company.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-600">{new Date(company.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => openEditDialog(company)}
                          className="hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => openDeleteDialog(company)}
                          className="hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash className="h-4 w-4 text-gray-400" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add Company Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Add New Company</DialogTitle>
              <DialogDescription className="text-gray-500">Enter the company details below.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-name" className="text-gray-700">Company Name *</Label>
                <Input
                  id="add-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter company name"
                  className="focus-visible:ring-indigo-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-address" className="text-gray-700">Address</Label>
                <Textarea
                  id="add-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter company address"
                  className="focus-visible:ring-indigo-600"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="add-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  className="data-[state=checked]:bg-indigo-600"
                />
                <Label htmlFor="add-active" className="text-gray-700 font-normal">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="border-gray-200 text-gray-700">Cancel</Button>
              <Button onClick={handleAddCompany} className="bg-indigo-600 hover:bg-indigo-700 text-white">
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
              <DialogTitle className="text-gray-900">Edit Company</DialogTitle>
              <DialogDescription className="text-gray-500">Update the company details below.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-gray-700">Company Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="focus-visible:ring-indigo-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address" className="text-gray-700">Address</Label>
                <Textarea
                  id="edit-address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="focus-visible:ring-indigo-600"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  className="data-[state=checked]:bg-indigo-600"
                />
                <Label htmlFor="edit-active" className="text-gray-700 font-normal">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="border-gray-200 text-gray-700">Cancel</Button>
              <Button onClick={handleEditCompany} className="bg-indigo-600 hover:bg-indigo-700 text-white">
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
              <DialogDescription className="text-gray-500">
                Are you sure you want to delete "{selectedCompany?.name}"? 
                {userRole === "super_admin" 
                  ? " This will PERMANENTLY DELETE all locations, inventory items, and audit data associated with this company."
                  : " This action cannot be undone."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="border-gray-200 text-gray-700">Cancel</Button>
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