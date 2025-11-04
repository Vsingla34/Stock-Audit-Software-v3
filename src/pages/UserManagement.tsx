// src/pages/UserManagement.tsx - REPLACE ENTIRE FILE
import { useState, useEffect } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Edit, Trash, Building2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  assigned_locations: string[] | null;
  assigned_companies: string[] | null;
}

interface Location {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
}

const UserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: "auditor" as "admin" | "auditor" | "client",
    assignedLocations: [] as string[],
    assignedCompanies: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch users
      const { data: usersData, error: usersError } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch all locations
      const { data: locationsData, error: locationsError } = await supabase
        .from("locations")
        .select("id, name")
        .eq("active", true)
        .order("name");

      if (locationsError) throw locationsError;
      setLocations(locationsData || []);

      // Fetch all companies
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!formData.email || !formData.password || !formData.name) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.role !== "admin" && formData.assignedCompanies.length === 0) {
      toast.error("Please assign at least one company for non-admin users");
      return;
    }

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
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
        // Create user profile
        const { error: profileError } = await supabase.from("user_profiles").insert([
          {
            id: authData.user.id,
            email: formData.email,
            name: formData.name,
            role: formData.role,
            assigned_locations: formData.assignedLocations.length > 0 ? formData.assignedLocations : null,
            assigned_companies: formData.assignedCompanies.length > 0 ? formData.assignedCompanies : null,
          },
        ]);

        if (profileError) throw profileError;

        toast.success("User created successfully", {
          description: `${formData.name} has been added with ${formData.assignedCompanies.length} companies assigned.`,
        });

        resetForm();
        setIsAddDialogOpen(false);
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

    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    if (formData.role !== "admin" && formData.assignedCompanies.length === 0) {
      toast.error("Please assign at least one company for non-admin users");
      return;
    }

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          name: formData.name,
          role: formData.role,
          assigned_locations: formData.assignedLocations.length > 0 ? formData.assignedLocations : null,
          assigned_companies: formData.assignedCompanies.length > 0 ? formData.assignedCompanies : null,
        })
        .eq("id", selectedUser.id);

      if (error) throw error;

      toast.success("User updated successfully");
      setIsEditDialogOpen(false);
      setSelectedUser(null);
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

    try {
      // Delete from user_profiles
      const { error: profileError } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", selectedUser.id);

      if (profileError) throw profileError;

      toast.success("User deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user", {
        description: error.message,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      name: "",
      role: "auditor",
      assignedLocations: [],
      assignedCompanies: [],
    });
  };

  const openAddDialog = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const openEditDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: "",
      name: user.name,
      role: user.role as "admin" | "auditor" | "client",
      assignedLocations: user.assigned_locations || [],
      assignedCompanies: user.assigned_companies || [],
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (user: UserProfile) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const toggleLocation = (locationId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedLocations: prev.assignedLocations.includes(locationId)
        ? prev.assignedLocations.filter((id) => id !== locationId)
        : [...prev.assignedLocations, locationId],
    }));
  };

  const toggleCompany = (companyId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedCompanies: prev.assignedCompanies.includes(companyId)
        ? prev.assignedCompanies.filter((id) => id !== companyId)
        : [...prev.assignedCompanies, companyId],
    }));
  };

  const getCompanyNames = (companyIds: string[] | null) => {
    if (!companyIds || companyIds.length === 0) return "All Companies";
    return companies
      .filter((c) => companyIds.includes(c.id))
      .map((c) => c.name)
      .join(", ");
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">Manage users and their company/location assignments</p>
          </div>
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned Companies</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {user.role === "admin" ? (
                        <span className="text-muted-foreground">All Companies</span>
                      ) : (
                        <span className="text-sm">{getCompanyNames(user.assigned_companies)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(user)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(user)}>
                        <Trash className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add User Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new user account with company and location assignments.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name">Name *</Label>
                  <Input
                    id="add-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-email">Email *</Label>
                  <Input
                    id="add-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-password">Password *</Label>
                  <Input
                    id="add-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-role">Role *</Label>
                  <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="auditor">Auditor</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Company Assignment */}
              {formData.role !== "admin" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Assign Companies * (Required for non-admin users)
                  </Label>
                  <Card className="p-4 max-h-48 overflow-y-auto">
                    {companies.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No companies available. Please create companies first.</p>
                    ) : (
                      <div className="space-y-2">
                        {companies.map((company) => (
                          <div key={company.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`add-company-${company.id}`}
                              checked={formData.assignedCompanies.includes(company.id)}
                              onCheckedChange={() => toggleCompany(company.id)}
                            />
                            <label htmlFor={`add-company-${company.id}`} className="text-sm cursor-pointer flex-1">
                              {company.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* Location Assignment */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Assign Locations (Optional)
                </Label>
                <Card className="p-4 max-h-48 overflow-y-auto">
                  {locations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No locations available</p>
                  ) : (
                    <div className="space-y-2">
                      {locations.map((location) => (
                        <div key={location.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`add-location-${location.id}`}
                            checked={formData.assignedLocations.includes(location.id)}
                            onCheckedChange={() => toggleLocation(location.id)}
                          />
                          <label htmlFor={`add-location-${location.id}`} className="text-sm cursor-pointer flex-1">
                            {location.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddUser}>
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
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user information and assignments.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role *</Label>
                  <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="auditor">Auditor</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Company Assignment */}
              {formData.role !== "admin" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Assign Companies * (Required for non-admin users)
                  </Label>
                  <Card className="p-4 max-h-48 overflow-y-auto">
                    {companies.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No companies available</p>
                    ) : (
                      <div className="space-y-2">
                        {companies.map((company) => (
                          <div key={company.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-company-${company.id}`}
                              checked={formData.assignedCompanies.includes(company.id)}
                              onCheckedChange={() => toggleCompany(company.id)}
                            />
                            <label htmlFor={`edit-company-${company.id}`} className="text-sm cursor-pointer flex-1">
                              {company.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* Location Assignment */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Assign Locations (Optional)
                </Label>
                <Card className="p-4 max-h-48 overflow-y-auto">
                  {locations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No locations available</p>
                  ) : (
                    <div className="space-y-2">
                      {locations.map((location) => (
                        <div key={location.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-location-${location.id}`}
                            checked={formData.assignedLocations.includes(location.id)}
                            onCheckedChange={() => toggleLocation(location.id)}
                          />
                          <label htmlFor={`edit-location-${location.id}`} className="text-sm cursor-pointer flex-1">
                            {location.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditUser}>
                <Edit className="mr-2 h-4 w-4" />
                Update User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{selectedUser?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteUser}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default UserManagement;