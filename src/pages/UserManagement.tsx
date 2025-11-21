
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
import { Users, Plus, Edit, Trash, Building2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
import { createClient } from "@supabase/supabase-js";

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
  companyId?: string | null;
}

interface Company {
  id: string;
  name: string;
}

const UserManagement = () => {
  const { currentUser } = useUser();
  const isSuperAdmin = currentUser?.role === "super_admin";

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
    role: "auditor" as "super_admin" | "admin" | "auditor" | "client",
    assignedLocations: [] as string[],
    assignedCompanies: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch Users
      let usersQuery = supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: usersData, error: usersError } = await usersQuery;
      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch Locations
      const { data: locationsData, error: locationsError } = await supabase
        .from("locations")
        .select("id, name, company_id")
        .eq("active", true)
        .order("name");

      if (locationsError) throw locationsError;
      
      const allLocations: Location[] = (locationsData || []).map((loc: any) => ({
        id: loc.id,
        name: loc.name,
        companyId: loc.company_id ?? null,
      }));

      // Fetch Companies
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (companiesError) throw companiesError;
      
      // Filter accessible data based on role
      if (isSuperAdmin) {
        setLocations(allLocations);
        setCompanies(companiesData || []);
      } else {
        // Admin can only see/assign companies they belong to
        const myCompanyIds = currentUser?.assigned_companies || [];
        setCompanies((companiesData || []).filter(c => myCompanyIds.includes(c.id)));
        setLocations(allLocations.filter(l => l.companyId && myCompanyIds.includes(l.companyId)));
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
      assignedLocations: [],
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
      assignedLocations: user.assigned_locations || [],
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

  // Helper to find all locations for a given list of company IDs
  const getAllLocationsForCompanies = (companyIds: string[]) => {
    return locations
      .filter(loc => loc.companyId && companyIds.includes(loc.companyId))
      .map(loc => loc.id);
  };

  // Toggle location manually
  const toggleLocation = (locationId: string) => {
    setFormData((prev) => ({
      ...prev,
      assignedLocations: prev.assignedLocations.includes(locationId)
        ? prev.assignedLocations.filter((id) => id !== locationId)
        : [...prev.assignedLocations, locationId],
    }));
  };

  // Toggle Company with Auto-Select logic for Admins
  const toggleCompany = (companyId: string) => {
    setFormData((prev) => {
      const newAssignedCompanies = prev.assignedCompanies.includes(companyId)
        ? prev.assignedCompanies.filter((id) => id !== companyId)
        : [...prev.assignedCompanies, companyId];

      let newAssignedLocations = prev.assignedLocations;

      if (prev.role === 'admin') {
        newAssignedLocations = getAllLocationsForCompanies(newAssignedCompanies);
      } else {
        const validLocationIds = locations
          .filter((loc) => loc.companyId && newAssignedCompanies.includes(loc.companyId))
          .map((loc) => loc.id);
        
        newAssignedLocations = prev.assignedLocations.filter((locId) =>
          validLocationIds.includes(locId)
        );
      }

      return {
        ...prev,
        assignedCompanies: newAssignedCompanies,
        assignedLocations: newAssignedLocations,
      };
    });
  };

  // Handle Role Change
  const handleRoleChange = (value: "super_admin" | "admin" | "auditor" | "client") => {
    setFormData(prev => {
      let newLocations = prev.assignedLocations;
      if (value === 'admin') {
        newLocations = getAllLocationsForCompanies(prev.assignedCompanies);
      }
      return { ...prev, role: value, assignedLocations: newLocations };
    });
  };

  const filteredLocationsForForm: Location[] =
    formData.assignedCompanies.length === 0
      ? []
      : locations.filter(
          (loc) =>
            !!loc.companyId &&
            formData.assignedCompanies.includes(loc.companyId)
        );

  const getCompanyNames = (companyIds: string[] | null) => {
    if (!companyIds || companyIds.length === 0) return "-";
    return companyIds.map(id => {
        const c = companies.find(comp => comp.id === id);
        return c ? c.name : null; 
    }).filter(Boolean).join(", ");
  };

  const getLocationNames = (locationIds: string[] | null) => {
    if (!locationIds || locationIds.length === 0) return "-";
    const names = locations
      .filter((l) => locationIds.includes(l.id))
      .map((l) => l.name);
    return names.length ? names.join(", ") : "-";
  };

  const filteredUsers = users.filter(user => {
    if (user.role === 'super_admin') return false;
    if (!isSuperAdmin && user.role === 'admin') return false;
    return true;
  });

  const handleAddUser = async () => {
    if (!formData.email || !formData.password || !formData.name) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.role !== "super_admin" && formData.assignedCompanies.length === 0) {
      toast.error("Please assign at least one company");
      return;
    }

    try {
      // ✅ FIX: Create a temporary client that does NOT persist session.
      // This prevents the new user login from overriding the current Super Admin session.
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: false, // Crucial: Don't save this session to localStorage
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
        // ✅ Use the main `supabase` client (Admin session) to insert profile
        // This works because the Super Admin has permission to insert into user_profiles
        const { error: profileError } = await supabase
          .from("user_profiles")
          .insert([
            {
              id: authData.user.id,
              email: formData.email,
              name: formData.name,
              role: formData.role,
              assigned_locations:
                formData.assignedLocations.length > 0
                  ? formData.assignedLocations
                  : null,
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

    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    if (formData.role !== "super_admin" && formData.assignedCompanies.length === 0) {
      toast.error("Please assign at least one company");
      return;
    }

    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          name: formData.name,
          role: formData.role,
          assigned_locations:
            formData.assignedLocations.length > 0
              ? formData.assignedLocations
              : null,
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

    try {
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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">
              Manage user accounts, roles, and access permissions.
            </p>
          </div>
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        {/* User table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Companies</TableHead>
                  <TableHead>Locations</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-4 text-muted-foreground"
                    >
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.role === "super_admin"
                              ? "default"
                              : user.role === "admin"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {user.role.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="line-clamp-2 text-sm text-muted-foreground">
                          {getCompanyNames(user.assigned_companies)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="line-clamp-2 text-sm text-muted-foreground">
                          {getLocationNames(user.assigned_locations)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(user)}
                          disabled={!isSuperAdmin && (user.role === "super_admin" || user.role === "admin")}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(user)}
                          disabled={!isSuperAdmin && (user.role === "super_admin" || user.role === "admin")}
                        >
                          <Trash className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ADD USER DIALOG */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with company and location assignments.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Name + Role */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-name">Name *</Label>
                  <Input
                    id="add-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: any) => handleRoleChange(value)}
                  >
                    <SelectTrigger>
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

              {/* Email + Password */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="add-email">Email *</Label>
                  <Input
                    id="add-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-password">Password *</Label>
                  <Input
                    id="add-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Companies */}
              {formData.role !== "super_admin" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Assign Companies *
                  </Label>
                  <Card className="p-4 max-h-48 overflow-y-auto">
                    {loading && companies.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Loading companies...
                      </p>
                    ) : companies.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
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
                              id={`add-company-${company.id}`}
                              checked={formData.assignedCompanies.includes(
                                company.id
                              )}
                              onCheckedChange={() => toggleCompany(company.id)}
                            />
                            <label
                              htmlFor={`add-company-${company.id}`}
                              className="text-sm cursor-pointer flex-1"
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

              {/* Locations (filtered by companies) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Assign Locations {formData.role === 'admin' ? '(Auto-selected)' : '(Optional)'}
                </Label>
                <Card className="p-4 max-h-48 overflow-y-auto">
                  {formData.role !== "super_admin" &&
                  formData.assignedCompanies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Select at least one company to see its locations.
                    </p>
                  ) : filteredLocationsForForm.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No locations available for the selected companies.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredLocationsForForm.map((location) => (
                        <div
                          key={location.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`add-location-${location.id}`}
                            checked={formData.assignedLocations.includes(
                              location.id
                            )}
                            // If role is admin, disable manual deselection to enforce "all locations"
                            disabled={formData.role === 'admin'}
                            onCheckedChange={() => toggleLocation(location.id)}
                          />
                          <label
                            htmlFor={`add-location-${location.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {location.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
                {formData.role === 'admin' && (
                  <p className="text-xs text-muted-foreground">
                    Admins are automatically assigned all locations for their companies.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAddUser}>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* EDIT USER DIALOG */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and assignments.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Name + Role */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: any) => handleRoleChange(value)}
                  >
                    <SelectTrigger>
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

              {/* Companies for edit */}
              {formData.role !== "super_admin" && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Assign Companies *
                  </Label>
                  <Card className="p-4 max-h-48 overflow-y-auto">
                    {loading && companies.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Loading companies...
                      </p>
                    ) : companies.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
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
                              id={`edit-company-${company.id}`}
                              checked={formData.assignedCompanies.includes(
                                company.id
                              )}
                              onCheckedChange={() => toggleCompany(company.id)}
                            />
                            <label
                              htmlFor={`edit-company-${company.id}`}
                              className="text-sm cursor-pointer flex-1"
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

              {/* Locations for edit */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Assign Locations {formData.role === 'admin' ? '(Auto-selected)' : '(Optional)'}
                </Label>
                <Card className="p-4 max-h-48 overflow-y-auto">
                  {formData.role !== "super_admin" &&
                  formData.assignedCompanies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Select at least one company to see its locations.
                    </p>
                  ) : filteredLocationsForForm.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No locations available for the selected companies.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredLocationsForForm.map((location) => (
                        <div
                          key={location.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`edit-location-${location.id}`}
                            checked={formData.assignedLocations.includes(
                              location.id
                            )}
                            disabled={formData.role === 'admin'}
                            onCheckedChange={() => toggleLocation(location.id)}
                          />
                          <label
                            htmlFor={`edit-location-${location.id}`}
                            className="text-sm cursor-pointer flex-1"
                          >
                            {location.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
                {formData.role === 'admin' && (
                  <p className="text-xs text-muted-foreground">
                    Admins are automatically assigned all locations for their companies.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleEditUser}>
                <Edit className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DELETE CONFIRM DIALOG */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this user? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
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
