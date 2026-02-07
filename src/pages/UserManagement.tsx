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
      
      // Filter users: 
      // 1. Super Admin sees everyone.
      // 2. Admin sees only users who are assigned to at least one of the Admin's assigned companies.
      let filteredUsers = usersData || [];

      if (!isSuperAdmin) {
        const myCompanyIds = currentUser?.assigned_companies || [];
        filteredUsers = filteredUsers.filter(user => {
            // Hide Super Admins from regular Admins
            if (user.role === 'super_admin') return false;
            
            // Check for intersection in assigned_companies
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
      // 1. Create Auth User (Backend Function or Client if allowed)
      // Note: Supabase client-side 'signUp' logs the user in. For admin creating user, we usually use a cloud function or secondary client.
      // Assuming a backend function 'create-user' exists or we are using a workaround.
      // For this prototype, let's assume we invoke a function.
      
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
            email: formData.email,
            password: formData.password,
            name: formData.name,
            role: formData.role,
            assigned_companies: formData.assignedCompanies
        }
      });

      if (error) throw error;
      
      toast.success("User created successfully");
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();

    } catch (error: any) {
      toast.error(error.message || "Failed to create user");
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
        const { error } = await supabase
            .from("user_profiles")
            .update({
                name: formData.name,
                role: formData.role,
                assigned_companies: formData.assignedCompanies
            })
            .eq("id", selectedUser.id);
        
        if (error) throw error;
        toast.success("User updated");
        setIsEditDialogOpen(false);
        fetchData();
    } catch (e: any) {
        toast.error("Failed to update user");
    }
  };

  const handleDeleteUser = async () => {
     if (!selectedUser) return;
     // Note: Deleting from Auth requires admin API. Deleting from profile is easy.
     // We will just delete profile or mark inactive. 
     // For now, let's assume we call a function or delete profile.
     try {
         const { error } = await supabase.from("user_profiles").delete().eq("id", selectedUser.id);
         if (error) throw error;
         toast.success("User deleted");
         setIsDeleteDialogOpen(false);
         fetchData();
     } catch(e) {
         toast.error("Failed to delete user");
     }
  };
  
  // CSV Import Logic (simplified)
  const handleImport = async () => {
      if (!importFile) return;
      setIsImporting(true);
      try {
          // Parse CSV
          const { data } = await processCSV(importFile);
          // Loop and create users (this might be slow, better to do in backend)
          let count = 0;
          for (const row of data) {
              if (row.email && row.password) {
                  await supabase.functions.invoke('create-user', {
                      body: {
                          email: row.email,
                          password: row.password,
                          name: row.name || row.email.split('@')[0],
                          role: row.role || 'auditor',
                          assigned_companies: row.company_ids ? row.company_ids.split(',') : []
                      }
                  });
                  count++;
              }
          }
          toast.success(`Imported ${count} users`);
          setIsImportDialogOpen(false);
          fetchData();
      } catch (e) {
          toast.error("Import failed");
      } finally {
          setIsImporting(false);
      }
  };

  const filteredUsers = users.filter(user => {
     if (companyFilter === "all") return true;
     return user.assigned_companies?.includes(companyFilter);
  });

  return (
    <AppLayout showSidebar={false}> {/* Sidebar hidden */}
      <div className="space-y-6 max-w-7xl mx-auto pt-6">
        
        {/* Header */}
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
            <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                <UploadCloud className="w-4 h-4 mr-2" />
                Import CSV
            </Button>
            <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add User
            </Button>
          </div>
        </div>

        {/* Filters */}
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

        {/* Users Table */}
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
                                        <Badge variant="outline" className="capitalize">
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid gap-2">
                        <Label>Name</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Email</Label>
                        <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Password</Label>
                        <Input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
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
                                {/* Only Super Admin can create Super Admins usually, simplifying here */}
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
                    <Button onClick={handleCreateUser}>Create User</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

         {/* Edit User Dialog */}
         <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid gap-2">
                        <Label>Name</Label>
                        <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                     {/* Role */}
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
                    <Button onClick={handleUpdateUser}>Update User</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        
        {/* Import Dialog */}
        <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Import Users</DialogTitle>
                    <DialogDescription>Upload a CSV file with columns: email, password, name, role, company_ids</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Input type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                </div>
                <DialogFooter>
                    <Button disabled={!importFile || isImporting} onClick={handleImport}>
                        {isImporting ? "Importing..." : "Start Import"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
};

export default UserManagement;