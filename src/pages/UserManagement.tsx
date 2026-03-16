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
import { Card, CardContent } from "@/components/ui/card";
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
  Plus, 
  Edit, 
  Trash, 
  Filter, 
  UploadCloud, 
  Loader2,
  ArrowLeft,
  Download
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

  const getAdminClient = () => {
    const SERVICE_ROLE_KEY = import.meta.env.VITE_SERVICE_KEY;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    if (!SERVICE_ROLE_KEY) {
      console.error("VITE_SERVICE_KEY is missing!");
      return null;
    }
    
    return createClient(supabaseUrl, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const adminClient = getAdminClient();
      let usersData: UserProfile[] = [];

      if (adminClient) {
          const { data, error } = await adminClient
            .from("user_profiles")
            .select("id, email, name, role, assigned_companies, created_at")
            .order("created_at", { ascending: false });
          
          if (error) throw error;
          usersData = (data as any[]) || [];
      } else {
          const { data, error } = await supabase
            .from("user_profiles")
            .select("id, email, name, role, assigned_companies, created_at")
            .order("created_at", { ascending: false });
            
          if (error) throw error;
          usersData = (data as any[]) || [];
      }
      
      let filteredUsers = usersData;

      if (!isSuperAdmin) {
        const myCompanyIds = currentUser?.assigned_companies || [];
        filteredUsers = filteredUsers.filter(user => {
            if (user.role === 'super_admin') return false;
            const userCompanies = user.assigned_companies || [];
            return userCompanies.some(id => myCompanyIds.includes(id));
        });
      }

      setUsers(filteredUsers);

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

  const handleCreateUser = async () => {
    try {
      const adminClient = getAdminClient();
      if (!adminClient) {
        toast.error("Config Error: VITE_SERVICE_KEY missing");
        return;
      }

      // 🔥 SECURITY CHECK: Prevent manual API bypassing
      const allowedIds = companies.map(c => c.id);
      const validCompanies = formData.assignedCompanies.filter(id => allowedIds.includes(id));
      
      if (formData.assignedCompanies.length > 0 && validCompanies.length === 0) {
          throw new Error("You do not have permission to assign to the selected companies.");
      }

      const { data, error } = await adminClient.auth.admin.createUser({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
        user_metadata: {
          name: formData.name,
          role: formData.role,
          assigned_companies: validCompanies
        }
      });

      if (error) throw error;
      if (!data.user) throw new Error("User created but ID missing");

      const { error: profileError } = await adminClient
        .from("user_profiles")
        .upsert({
            id: data.user.id,
            email: formData.email,
            name: formData.name,
            role: formData.role,
            assigned_companies: validCompanies,
            created_at: new Date().toISOString()
        });
      
      if (profileError) {
         console.error("Profile creation failed:", profileError);
         toast.error("Account created but profile failed. Please check logs.");
      } else {
         toast.success("User created successfully");
      }

      setIsAddDialogOpen(false);
      resetForm();
      await fetchData();

    } catch (error: any) {
      console.error("Creation Error:", error);
      toast.error(error.message || "Failed to create user");
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
        const adminClient = getAdminClient();
        if (!adminClient) throw new Error("Admin client missing");

        // 🔥 SECURITY CHECK: Prevent manual API bypassing
        const allowedIds = companies.map(c => c.id);
        const validCompanies = formData.assignedCompanies.filter(id => allowedIds.includes(id));

        const { error } = await adminClient
            .from("user_profiles")
            .update({
                name: formData.name,
                role: formData.role,
                assigned_companies: validCompanies
            })
            .eq("id", selectedUser.id);
        
        if (error) throw error;
        toast.success("User updated");
        setIsEditDialogOpen(false);
        fetchData();
    } catch (e: any) {
        toast.error("Failed to update user: " + e.message);
    }
  };

  const handleDeleteUser = async () => {
     if (!selectedUser) return;
     try {
         const adminClient = getAdminClient();
         if (!adminClient) {
            toast.error("Config Error: VITE_SERVICE_KEY missing");
            return;
         }

         const { error: authError } = await adminClient.auth.admin.deleteUser(selectedUser.id);
         if (authError && !authError.message.includes("not found")) throw authError;

         const { error: dbError } = await adminClient
            .from("user_profiles")
            .delete()
            .eq("id", selectedUser.id);
         
         if (dbError) throw dbError;

         toast.success("User deleted successfully");
         setIsDeleteDialogOpen(false);
         await fetchData();

     } catch(e: any) {
         console.error("Delete Error:", e);
         toast.error("Failed to delete user: " + e.message);
     }
  };

  const handleDownloadTemplate = () => {
    const headers = ["email", "password", "name", "role", "assigned_companies"];
    const exampleRow = ["auditor1@example.com", "SecurePass123!", "John Auditor", "auditor", '"Company A, Company B"'];
    
    const csvContent = headers.join(",") + "\n" + exampleRow.join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "user_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("Template downloaded successfully");
  };
  
 const handleImport = async () => {
    if (!importFile) return;
    setIsImporting(true);
    
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const csvText = e.target?.result as string;
        const rows = processCSV(csvText);
        
        if (!rows || rows.length === 0) {
          throw new Error("CSV is empty or could not be parsed.");
        }

        // Map containing ONLY companies the current admin is assigned to
        const companyLookup = new Map(
          companies.map(c => [c.name.toLowerCase().trim(), c.id])
        );

        // 🔥 NEW: PRE-FLIGHT VALIDATION Check every row before creating any users!
        const invalidRows: string[] = [];
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row.email || !row.password) {
            invalidRows.push(`Row ${i + 1}: Missing email or password`);
            continue;
          }
          
          const rawCompanyNames = row['assigned companies'] || row['assigned_companies'] || "";
          const names = rawCompanyNames.split(',').map((n: string) => n.trim()).filter(Boolean);
          
          if (names.length === 0) {
            invalidRows.push(`Row ${i + 1} (${row.email}): Must have at least one assigned company.`);
          } else {
            for (const name of names) {
              if (!companyLookup.has(name.toLowerCase())) {
                // Fails if company doesn't exist OR if Admin doesn't have permission for it
                invalidRows.push(`Row ${i + 1} (${row.email}): Company "${name}" is invalid or you lack permission.`);
              }
            }
          }
        }

        // Abort entirely if ANY row violates permissions
        if (invalidRows.length > 0) {
          toast.error("Import Aborted: Validation Failed", {
            description: invalidRows[0] + (invalidRows.length > 1 ? ` (+${invalidRows.length - 1} more errors)` : ""),
            duration: 5000
          });
          setIsImporting(false);
          return; 
        }

        const SERVICE_ROLE_KEY = import.meta.env.VITE_SERVICE_KEY;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const adminClient = createClient(supabaseUrl, SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false }
        });

        let successCount = 0;

        for (const row of rows) {
          const email = row.email?.trim();
          const password = row.password?.trim();
          const name = row.name?.trim() || email?.split('@')[0];
          const role = (row.role?.trim().toLowerCase() || 'auditor') as any;
          
          const rawCompanyNames = row['assigned companies'] || row['assigned_companies'] || "";
          const companyIds = rawCompanyNames
            .split(',')
            .map((name: string) => companyLookup.get(name.trim().toLowerCase()))
            .filter(Boolean) as string[]; 

          if (email && password) {
            const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
              email: email,
              password: password,
              email_confirm: true,
              user_metadata: { name, role, assigned_companies: companyIds }
            });

            if (!authError && authData.user) {
              const { error: profileError } = await adminClient.from("user_profiles").upsert({
                id: authData.user.id,
                email: email,
                name: name,
                role: role,
                assigned_companies: companyIds,
                created_at: new Date().toISOString()
              });
              
              if (!profileError) successCount++;
            } else if (authError) {
              console.error(`Auth Error for ${email}:`, authError.message);
            }
          }
        }

        toast.success(`Imported ${successCount} users successfully.`);
        setIsImportDialogOpen(false);
        setImportFile(null);
        fetchData();
      } catch (e: any) {
        console.error("Import Error:", e);
        toast.error("Import failed: " + e.message);
      } finally {
        setIsImporting(false);
      }
    };

    reader.readAsText(importFile);
  };

  const filteredUsers = users.filter(user => {
     if (companyFilter === "all") return true;
     return user.assigned_companies?.includes(companyFilter);
  });

  return (
    <AppLayout showSidebar={false}>
      <div className="space-y-6 max-w-7xl mx-auto pt-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
             <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
             </Button>
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">User Management</h1>
                <p className="text-sm text-gray-500">Create and manage user access</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)} className="bg-white">
                <UploadCloud className="w-4 h-4 mr-2 text-indigo-600" />
                Import CSV
            </Button>
            <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Add User
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-4 rounded-lg border shadow-sm">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">Filter by Company:</span>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50">
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Assigned Companies</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                                </TableCell>
                            </TableRow>
                        ) : filteredUsers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-gray-500">
                                    No users found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredUsers.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900">{user.name}</span>
                                            <span className="text-xs text-gray-500">{user.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="capitalize bg-indigo-50 text-indigo-700 border-indigo-100">
                                            {user.role.replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {user.assigned_companies && user.assigned_companies.length > 0 ? (
                                                user.assigned_companies.map(cid => {
                                                    const cName = companies.find(c => c.id === cid)?.name;
                                                    return cName ? (
                                                        <span key={cid} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                            {cName}
                                                        </span>
                                                    ) : null;
                                                })
                                            ) : (
                                                <span className="text-gray-400 text-xs">-</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button size="icon" variant="ghost" onClick={() => {
                                                setSelectedUser(user);
                                                setFormData({
                                                    name: user.name,
                                                    email: user.email,
                                                    password: "",
                                                    role: user.role as any,
                                                    assignedCompanies: user.assigned_companies || []
                                                });
                                                setIsEditDialogOpen(true);
                                            }}>
                                                <Edit className="w-4 h-4 text-gray-500" />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => {
                                                setSelectedUser(user);
                                                setIsDeleteDialogOpen(true);
                                            }}>
                                                <Trash className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid gap-2">
                        <Label>Name</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. John Doe" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Email</Label>
                        <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="john@example.com" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Password</Label>
                        <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Minimum 6 characters" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Role</Label>
                        <Select value={formData.role} onValueChange={(v: any) => setFormData({...formData, role: v})}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="auditor">Auditor</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="client">Client</SelectItem>
                                {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Assigned Companies</Label>
                        <div className="border rounded p-2 max-h-32 overflow-y-auto space-y-1">
                            {companies.map(c => (
                                <div key={c.id} className="flex items-center space-x-2">
                                    <Checkbox 
                                        checked={formData.assignedCompanies.includes(c.id)}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setFormData({...formData, assignedCompanies: [...formData.assignedCompanies, c.id]});
                                            } else {
                                                setFormData({...formData, assignedCompanies: formData.assignedCompanies.filter(id => id !== c.id)});
                                            }
                                        }}
                                    />
                                    <span className="text-sm">{c.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleCreateUser} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">Create User</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

         {/* Edit User Dialog */}
         <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid gap-2">
                        <Label>Name</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                     <div className="grid gap-2">
                        <Label>Role</Label>
                        <Select value={formData.role} onValueChange={(v: any) => setFormData({...formData, role: v})}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="auditor">Auditor</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="client">Client</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Assigned Companies</Label>
                        <div className="border rounded p-2 max-h-32 overflow-y-auto space-y-1">
                            {companies.map(c => (
                                <div key={c.id} className="flex items-center space-x-2">
                                    <Checkbox 
                                        checked={formData.assignedCompanies.includes(c.id)}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setFormData({...formData, assignedCompanies: [...formData.assignedCompanies, c.id]});
                                            } else {
                                                setFormData({...formData, assignedCompanies: formData.assignedCompanies.filter(id => id !== c.id)});
                                            }
                                        }}
                                    />
                                    <span className="text-sm">{c.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleUpdateUser} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">Update User</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        {/* Import Dialog with Template Option */}
        <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Bulk Import Users</DialogTitle>
                    <DialogDescription>
                        Create multiple users at once by uploading a CSV file.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="py-4 space-y-6">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="text-sm text-gray-600">
                            <p className="font-medium text-gray-900 mb-1">Need the exact format?</p>
                            <p>Download the CSV template with example data.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="shrink-0 bg-white">
                            <Download className="w-4 h-4 mr-2 text-indigo-600" /> Template
                        </Button>
                    </div>

                    <div className="grid gap-2">
                        <Label>Upload your completed CSV</Label>
                        <Input 
                            type="file" 
                            accept=".csv" 
                            className="cursor-pointer"
                            onChange={(e) => setImportFile(e.target.files?.[0] || null)} 
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => { setIsImportDialogOpen(false); setImportFile(null); }}>
                        Cancel
                    </Button>
                    <Button disabled={!importFile || isImporting} onClick={handleImport} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                        {isImporting ? "Importing..." : "Start Import"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

         {/* Delete Confirmation Dialog */}
         <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <div className="flex items-center gap-2 text-red-600 mb-2">
                        <Trash className="h-5 w-5" />
                        <DialogTitle>Delete User</DialogTitle>
                    </div>
                    <DialogDescription>
                        Are you sure you want to completely remove <strong>{selectedUser?.name}</strong> from the system? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleDeleteUser}>Yes, Delete User</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
};

export default UserManagement;