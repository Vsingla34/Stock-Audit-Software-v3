import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Plus, 
  Edit, 
  Trash, 
  Building2, 
  Filter, 
  UploadCloud, 
  FileSpreadsheet,
  Loader2,
  Download,
  ArrowLeft 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { createClient } from "@supabase/supabase-js";
import { processCSV } from "@/components/upload/utils/csvUtils";

// ... [Existing interfaces stay the same] ...
interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  assigned_companies: string[] | null;
}

interface Company {
  id: string;
  name: string;
}

const UserManagement = () => {
  const navigate = useNavigate(); 
  const { currentUser } = useUser();
  const isSuperAdmin = currentUser?.role === "super_admin";

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: "auditor" as "super_admin" | "admin" | "auditor" | "client",
    assignedCompanies: [] as string[],
  });

  // ... [Existing data fetching & handler functions remain exactly the same] ...
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      let usersQuery = supabase
        .from("user_profiles")
        .select("id, email, name, role, assigned_companies, created_at")
        .order("created_at", { ascending: false });

      const { data: usersData, error: usersError } = await usersQuery;
      if (usersError) throw usersError;
      setUsers(usersData || []);

      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (companiesError) throw companiesError;
      
      if (isSuperAdmin) {
        setCompanies(companiesData || []);
      } else {
        const myCompanyIds = currentUser?.assigned_companies || [];
        setCompanies((companiesData || []).filter(c => myCompanyIds.includes(c.id)));
      }

    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      name: "",
      role: "auditor",
      assignedCompanies: [],
    });
  };

  const openAddDialog = () => {
    resetForm();
    setSelectedUser(null);
    setIsAddDialogOpen(true);
  };

  const openEditDialog = (user: UserProfile) => {
    if (!isSuperAdmin && (user.role === "super_admin" || user.role === "admin")) {
       toast.error("You do not have permission to edit this user.");
       return;
    }
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: "", 
      name: user.name,
      role: user.role as any,
      assignedCompanies: user.assigned_companies || [],
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (user: UserProfile) => {
    if (!isSuperAdmin && (user.role === "super_admin" || user.role === "admin")) {
       toast.error("You do not have permission to delete this user.");
       return;
    }
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleAddUser = async () => {
    try {
      if (!formData.email || !formData.password || !formData.name) {
        toast.error("Please fill all required fields");
        return;
      }
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
      const { data: authData, error: authError } = await tempSupabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role: formData.role,
          },
        },
      });
      if (authError) throw authError;
      if (authData.user) {
        const { error: profileError } = await supabase
          .from("user_profiles")
          .insert({
            id: authData.user.id,
            email: formData.email,
            name: formData.name,
            role: formData.role,
            assigned_companies: formData.assignedCompanies.length > 0 ? formData.assignedCompanies : null
          });
          
        if (profileError) throw profileError;
        toast.success(`User ${formData.email} created successfully`);
        setIsAddDialogOpen(false);
        fetchData();
      }
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    try {
      const updates: any = {
        name: formData.name,
        role: formData.role,
        assigned_companies: formData.assignedCompanies.length > 0 ? formData.assignedCompanies : null
      };
      
      const { error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("id", selectedUser.id);

      if (error) throw error;
      toast.success("User updated successfully");
      setIsEditDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update user");
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      const { error } = await supabase.auth.admin.deleteUser(selectedUser.id);
      if (error) throw error; 
      // Note: If RL policies or triggers aren't set up, you might need to manually delete from user_profiles too, 
      // but usually ON DELETE CASCADE handles it if linked.
      const { error: dbError } = await supabase.from("user_profiles").delete().eq("id", selectedUser.id);
      
      toast.success("User deleted successfully");
      setIsDeleteDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error("Delete failed. (Note: Only Super Admins can delete via Auth API on client side if enabled, otherwise use Edge Function)");
    }
  };

  // ... [Import Logic, Form Renders - Keeping them compact for clarity] ...
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setImportFile(e.target.files[0]);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setIsImporting(true);
    try {
      const results = await processCSV(importFile);
      let successCount = 0;
      let failCount = 0;
      
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );

      for (const row of results.data) {
        if (!row.email || !row.password || !row.name || !row.role) {
          failCount++;
          continue;
        }
        try {
          const { data, error } = await tempSupabase.auth.signUp({
            email: row.email,
            password: row.password,
            options: { data: { name: row.name, role: row.role } }
          });
          if (!error && data.user) {
            await supabase.from("user_profiles").insert({
              id: data.user.id,
              email: row.email,
              name: row.name,
              role: row.role,
              assigned_companies: null 
            });
            successCount++;
          } else {
            failCount++;
          }
        } catch (e) {
          failCount++;
        }
      }
      toast.success(`Import complete. Success: ${successCount}, Failed: ${failCount}`);
      setIsImportDialogOpen(false);
      setImportFile(null);
      fetchData();
    } catch (error: any) {
      toast.error("Failed to process file");
    } finally {
      setIsImporting(false);
    }
  };

  const renderFormContent = () => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="user-name">Name *</Label>
          <Input 
            id="user-name" 
            value={formData.name} 
            onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
            className="focus-visible:ring-indigo-600"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-role">Role *</Label>
          <Select 
            value={formData.role} 
            onValueChange={(val: any) => setFormData({ ...formData, role: val })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="auditor">Auditor</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="user-email">Email *</Label>
        <Input 
          id="user-email" 
          type="email" 
          value={formData.email} 
          onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
          disabled={!!selectedUser} 
        />
      </div>

      {!selectedUser && (
        <div className="space-y-2">
          <Label htmlFor="user-password">Password *</Label>
          <Input 
            id="user-password" 
            type="password" 
            value={formData.password} 
            onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
          />
        </div>
      )}

      {isSuperAdmin && (
        <div className="space-y-2">
          <Label>Assign Companies</Label>
          <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
            {companies.map((company) => (
              <div key={company.id} className="flex items-center space-x-2">
                <Checkbox 
                  id={`comp-${company.id}`} 
                  checked={formData.assignedCompanies.includes(company.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setFormData({ ...formData, assignedCompanies: [...formData.assignedCompanies, company.id] });
                    } else {
                      setFormData({ ...formData, assignedCompanies: formData.assignedCompanies.filter(id => id !== company.id) });
                    }
                  }}
                />
                <Label htmlFor={`comp-${company.id}`} className="text-sm font-normal cursor-pointer">
                  {company.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const filteredUsers = users.filter(user => {
    if (companyFilter === "all") return true;
    return user.assigned_companies?.includes(companyFilter);
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="md:hidden">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">User Management</h1>
             </div>
             <p className="text-sm text-gray-500">Manage system users and their roles</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
             <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="w-full sm:w-auto">
                <UploadCloud className="mr-2 h-4 w-4" /> Import CSV
             </Button>
             <Button onClick={openAddDialog} className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Add User
             </Button>
          </div>
        </div>

        {isSuperAdmin && (
           <div className="w-full md:w-[250px]">
             <Select value={companyFilter} onValueChange={setCompanyFilter}>
               <SelectTrigger>
                 <Filter className="mr-2 h-4 w-4 text-gray-500" />
                 <SelectValue placeholder="Filter by Company" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Companies</SelectItem>
                 {companies.map((c) => (
                   <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
        )}

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="border-b border-gray-100 bg-gray-50/50">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Users className="h-5 w-5 text-indigo-600" />
              Users Directory
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             {/* RESPONSIVE: Overflow X Auto */}
             <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      <TableHead className="font-semibold text-gray-700">Name</TableHead>
                      <TableHead className="font-semibold text-gray-700">Role</TableHead>
                      <TableHead className="font-semibold text-gray-700 hidden md:table-cell">Email</TableHead>
                      <TableHead className="font-semibold text-gray-700 hidden lg:table-cell">Companies</TableHead>
                      <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                       <TableRow><TableCell colSpan={5} className="text-center py-8">Loading users...</TableCell></TableRow>
                    ) : filteredUsers.length === 0 ? (
                       <TableRow><TableCell colSpan={5} className="text-center py-8 text-gray-500">No users found</TableCell></TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id} className="hover:bg-gray-50">
                          <TableCell className="font-medium text-gray-900">
                            <div className="flex flex-col">
                               <span>{user.name}</span>
                               {/* Mobile Only Email */}
                               <span className="md:hidden text-xs text-gray-500">{user.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`capitalize ${
                              user.role === 'super_admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              user.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                              user.role === 'auditor' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-gray-50 text-gray-700 border-gray-200'
                            }`}>
                              {user.role.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-600 hidden md:table-cell">{user.email}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                             <div className="flex flex-wrap gap-1">
                                {(user.assigned_companies || []).map(cid => {
                                   const cName = companies.find(c => c.id === cid)?.name;
                                   return cName ? (
                                     <span key={cid} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">
                                       {cName}
                                     </span>
                                   ) : null;
                                })}
                                {(!user.assigned_companies || user.assigned_companies.length === 0) && <span className="text-gray-400 text-xs">-</span>}
                             </div>
                          </TableCell>
                          <TableCell className="text-right">
                             <div className="flex justify-end gap-2">
                               <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)} className="h-8 w-8 text-gray-500 hover:text-indigo-600">
                                  <Edit className="h-4 w-4" />
                               </Button>
                               <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(user)} className="h-8 w-8 text-gray-500 hover:text-red-600">
                                  <Trash className="h-4 w-4" />
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

        {/* --- DIALOGS (Add, Edit, Delete, Import) remain same structure --- */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
           <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
              {renderFormContent()}
              <DialogFooter><Button onClick={handleAddUser}>Create User</Button></DialogFooter>
           </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
           <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
              {renderFormContent()}
              <DialogFooter><Button onClick={handleEditUser}>Save Changes</Button></DialogFooter>
           </DialogContent>
        </Dialog>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
           <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Confirm Delete</DialogTitle><DialogDescription>Are you sure you want to delete {selectedUser?.name}? This action cannot be undone.</DialogDescription></DialogHeader>
              <DialogFooter><Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button><Button variant="destructive" onClick={handleDeleteUser}>Delete</Button></DialogFooter>
           </DialogContent>
        </Dialog>

        <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
           <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Import Users from CSV</DialogTitle><DialogDescription>Upload a CSV with columns: email, password, name, role</DialogDescription></DialogHeader>
              <div className="py-4"><Input type="file" accept=".csv" onChange={handleFileUpload} />
                   <div className="mt-2 text-xs text-gray-500">Supported Roles: super_admin, admin, auditor, client</div>
              </div>
              <DialogFooter><Button onClick={handleImport} disabled={!importFile || isImporting}>{isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />} Import Users</Button></DialogFooter>
           </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default UserManagement;