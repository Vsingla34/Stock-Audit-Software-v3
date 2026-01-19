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

  const toggleCompany = (companyId: string) => {
    setFormData((prev) => {
      const isSelected = prev.assignedCompanies.includes(companyId);
      const newAssignedCompanies = isSelected
        ? prev.assignedCompanies.filter((id) => id !== companyId)
        : [...prev.assignedCompanies, companyId];

      return {
        ...prev,
        assignedCompanies: newAssignedCompanies,
      };
    });
  };

  const handleRoleChange = (value: "super_admin" | "admin" | "auditor" | "client") => {
    setFormData(prev => ({ ...prev, role: value }));
  };

  const getCompanyNames = (companyIds: string[] | null) => {
    if (!companyIds || companyIds.length === 0) return "-";
    return companyIds.map(id => {
        const c = companies.find(comp => comp.id === id);
        return c ? c.name : null; 
    }).filter(Boolean).join(", ");
  };

  const filteredUsers = users.filter(user => {
    if (user.role === 'super_admin') return false;

    if (!isSuperAdmin) {
      if (user.role === 'admin') return false;
      const myCompanies = currentUser?.assigned_companies || [];
      const userCompanies = user.assigned_companies || [];
      const hasCommonCompany = userCompanies.some(id => myCompanies.includes(id));
      if (!hasCommonCompany) return false;
    }

    if (companyFilter !== "all") {
      const userCompanies = user.assigned_companies || [];
      if (!userCompanies.includes(companyFilter)) return false;
    }

    return true;
  });

  const validateForm = () => {
    if (!formData.email || (!selectedUser && !formData.password) || !formData.name) {
      toast.error("Please fill in all required fields");
      return false;
    }

    if (formData.role !== "super_admin") {
      if (formData.assignedCompanies.length === 0) {
        toast.error("Please assign at least one company");
        return false;
      }
    }
    return true;
  };

  const handleAddUser = async () => {
    if (!validateForm()) return;

    try {
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
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
          .insert([
            {
              id: authData.user.id,
              email: formData.email,
              name: formData.name,
              role: formData.role,
              assigned_companies:
                formData.assignedCompanies.length > 0
                  ? formData.assignedCompanies
                  : null,
            },
          ]);

        if (profileError) throw profileError;

        toast.success("User created successfully");
        setIsAddDialogOpen(false);
        resetForm();
        fetchData();
      }
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error("Failed to create user", {
        description: error.message,
      });
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser) return;
    if (!validateForm()) return;

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          name: formData.name,
          role: formData.role,
          assigned_companies:
            formData.assignedCompanies.length > 0
              ? formData.assignedCompanies
              : null,
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      toast.success("User updated successfully");
      setIsEditDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user", {
        description: error.message,
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    if (selectedUser.id === currentUser?.id) {
        toast.error("Cannot delete your own account.");
        return;
    }

    try {
      toast.info("Unlinking user data...", { duration: 1500 });

      // FIX: Aggressively DELETE dependent records.
      // NOTE: If these fail to delete rows (count=0), it means RLS blocked it.

      // 1. DELETE Audit Reports
      const { error: reportError, count: reportCount } = await supabase
        .from('audit_reports' as any)
        .delete({ count: 'exact' })
        .eq('finalized_by', selectedUser.id);
      
      if (reportError) {
         console.error("Report delete error:", reportError);
      }

      // 2. DELETE Upload History
      const { error: uploadError } = await supabase
        .from('inventory_upload_history')
        .delete({ count: 'exact' })
        .eq('uploaded_by', selectedUser.id);

      if (uploadError) {
         console.error("Upload delete error:", uploadError);
      }

      // 3. DELETE Questionnaire Answers
      await supabase
        .from('questionnaire_answers')
        .delete()
        .eq('answered_by', selectedUser.id);

      // 4. DELETE User Account via RPC
      const { error } = await supabase.rpc('delete_user_account', { 
        user_id: selectedUser.id 
      });

      if (error) throw error;

      toast.success("User account deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchData();

    } catch (error: any) {
      console.error("Error deleting user:", error);
      
      let msg = error.message || "Could not delete user account";
      
      // CRITICAL FIX: Specific Guidance for RLS Errors
      if (msg.includes("foreign key constraint") && msg.includes("audit_reports")) {
         msg = "Error: Database Permissions (RLS) are preventing deletion of this user's Audit Reports.";
         
         // Display specific instruction toast
         toast.error("PERMISSION BLOCKED", {
            description: "Go to Supabase SQL Editor and run: ALTER TABLE audit_reports DROP CONSTRAINT audit_reports_finalized_by_fkey, ADD CONSTRAINT audit_reports_finalized_by_fkey FOREIGN KEY (finalized_by) REFERENCES auth.users(id) ON DELETE SET NULL;",
            duration: 10000,
         });
         return;
      }

      toast.error("Failed to delete user", {
        description: msg,
      });
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
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

      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

      let successCount = 0;
      let failCount = 0;

      for (const row of rows) {
        const name = row['name'] || row['full name'];
        const email = row['email'] || row['email address'];
        const password = row['password'];
        const role = (row['role'] || 'auditor').toLowerCase();
        
        const companyNamesStr = row['companies'] || row['company'] || "";

        if (!name || !email || !password) {
           console.warn("Skipping row due to missing required fields:", row);
           failCount++;
           continue; 
        }

        const assignedCompanies: string[] = [];
        const companyNames = companyNamesStr.split(/[;,|]+/).map((n:string) => n.trim().toLowerCase());
        
        if (companyNames.length > 0 && companyNames[0] !== "") {
           companies.forEach(c => {
              if (companyNames.includes(c.name.toLowerCase())) {
                 assignedCompanies.push(c.id);
              }
           });
        }

        try {
           const { data: authData, error: authError } = await tempSupabase.auth.signUp({
            email,
            password,
            options: { data: { name, role } }
           });

           if (authError) throw authError;

           if (authData.user) {
             const { error: profileError } = await supabase.from("user_profiles").insert([{
               id: authData.user.id,
               email,
               name,
               role,
               assigned_companies: assignedCompanies.length > 0 ? assignedCompanies : null
             }]);
             if (profileError) throw profileError;
             successCount++;
           }
        } catch (err) {
           console.error("Failed to import user:", email, err);
           failCount++;
        }
      }

      toast.success(`Import complete`, {
         description: `Successfully added ${successCount} users. Failed: ${failCount}`
      });
      setIsImportDialogOpen(false);
      setImportFile(null);
      fetchData();

    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Failed to process file", { description: error.message });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ["Name,Email,Password,Role,Companies"];
    const example = ["John Doe,john@example.com,SecurePass123,auditor,Company A;Company B"];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join("\n") + "\n" + example.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "user_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderFormContent = () => (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="user-name">Name *</Label>
          <Input
            id="user-name"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            className="focus-visible:ring-indigo-600"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-role">Role *</Label>
          <Select
            value={formData.role}
            onValueChange={(value: any) => handleRoleChange(value)}
          >
            <SelectTrigger id="user-role" className="focus:ring-indigo-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
              {isSuperAdmin && <SelectItem value="admin">Admin</SelectItem>}
              <SelectItem value="auditor">Auditor</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="user-email">Email *</Label>
          <Input
            id="user-email"
            type="email"
            value={formData.email}
            disabled={!!selectedUser} 
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            className="focus-visible:ring-indigo-600"
          />
        </div>
        {!selectedUser && (
          <div className="space-y-2">
            <Label htmlFor="user-password">Password *</Label>
            <Input
              id="user-password"
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="focus-visible:ring-indigo-600"
            />
          </div>
        )}
      </div>

      {formData.role !== "super_admin" && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-indigo-600" />
            Assign Companies *
          </Label>
          <Card className="p-4 max-h-48 overflow-y-auto border-gray-200 bg-gray-50/50">
            {loading && companies.length === 0 ? (
              <p className="text-sm text-gray-500">
                Loading companies...
              </p>
            ) : companies.length === 0 ? (
              <p className="text-sm text-gray-500">
                No companies available.
              </p>
            ) : (
              <div className="space-y-2">
                {companies.map((company) => (
                  <div
                    key={company.id}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`company-${company.id}`}
                      checked={formData.assignedCompanies.includes(
                        company.id
                      )}
                      onCheckedChange={() => toggleCompany(company.id)}
                      className="data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600 border-gray-300"
                    />
                    <label
                      htmlFor={`company-${company.id}`}
                      className="text-sm cursor-pointer flex-1 font-medium text-gray-700"
                    >
                      {company.name}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );

  return (
    <AppLayout showSidebar={false}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)} 
              className="p-0 hover:bg-transparent"
            >
              <ArrowLeft className="h-6 w-6 text-gray-500 hover:text-gray-900" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">User Management</h1>
              <p className="text-gray-500">
                Manage user accounts, roles, and access permissions.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-[200px]">
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="border-gray-200 focus:ring-indigo-600">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <SelectValue placeholder="Filter by Company" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => setIsImportDialogOpen(true)} variant="outline" className="whitespace-nowrap bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50">
              <UploadCloud className="mr-2 h-4 w-4" />
              Import CSV
            </Button>

            <Button onClick={openAddDialog} className="whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="border-b border-gray-100 bg-gray-50/50">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Users className="h-4 w-4 text-indigo-600" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="font-semibold text-gray-700">Name</TableHead>
                  <TableHead className="font-semibold text-gray-700">Email</TableHead>
                  <TableHead className="font-semibold text-gray-700">Role</TableHead>
                  <TableHead className="font-semibold text-gray-700">Companies</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5} 
                      className="text-center py-8 text-gray-500"
                    >
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-gray-50/50 transition-colors border-gray-100">
                      <TableCell className="font-medium text-gray-900">{user.name}</TableCell>
                      <TableCell className="text-gray-600">{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`
                            ${user.role === 'super_admin' ? 'bg-purple-100 text-purple-700 border-purple-200' : ''}
                            ${user.role === 'admin' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : ''}
                            ${user.role === 'auditor' ? 'bg-blue-100 text-blue-700 border-blue-200' : ''}
                            ${user.role === 'client' ? 'bg-green-100 text-green-700 border-green-200' : ''}
                          `}
                        >
                          {user.role.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="line-clamp-2 text-sm text-gray-600" title={getCompanyNames(user.assigned_companies)}>
                          {getCompanyNames(user.assigned_companies)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(user)}
                          disabled={!isSuperAdmin && (user.role === "super_admin" || user.role === "admin")}
                          className="hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(user)}
                          disabled={!isSuperAdmin && (user.role === "super_admin" || user.role === "admin")}
                          className="hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add User Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Add New User</DialogTitle>
              <DialogDescription className="text-gray-500">
                Create a new user account with company assignments.
              </DialogDescription>
            </DialogHeader>
            {renderFormContent()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="border-gray-200 text-gray-700">
                Cancel
              </Button>
              <Button onClick={handleAddUser} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Edit User</DialogTitle>
              <DialogDescription className="text-gray-500">
                Update user information and company assignments.
              </DialogDescription>
            </DialogHeader>
            {renderFormContent()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="border-gray-200 text-gray-700">
                Cancel
              </Button>
              <Button onClick={handleEditUser} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Edit className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-600">Delete User</DialogTitle>
              <DialogDescription className="text-gray-500">
                Are you sure you want to delete this user? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="border-gray-200 text-gray-700">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-700 text-white">
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Users Dialog */}
        <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-gray-900 flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-indigo-600" />
                Import Users
              </DialogTitle>
              <DialogDescription className="text-gray-500">
                Upload a CSV file to create users in bulk.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg space-y-2">
                <h4 className="text-sm font-medium text-indigo-900 flex items-center gap-2">
                   <FileSpreadsheet className="h-4 w-4" />
                   CSV Format Guide
                </h4>
                <p className="text-xs text-indigo-700">
                   Required columns: <code className="bg-white px-1 rounded">Name</code>, <code className="bg-white px-1 rounded">Email</code>, <code className="bg-white px-1 rounded">Password</code>, <code className="bg-white px-1 rounded">Role</code>
                </p>
                <p className="text-xs text-indigo-700">
                   Optional: <code className="bg-white px-1 rounded">Companies</code> (Use semicolons ; to separate multiple)
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
    </AppLayout>
  );
};

export default UserManagement;