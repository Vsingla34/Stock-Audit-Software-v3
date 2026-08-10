// Fix 1.3 + 1.4: All privileged user operations now go through the
// manage-users Edge Function. VITE_SERVICE_KEY and createClient are gone.

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
  Download,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";
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

// ── Edge Function caller ──────────────────────────────────────────────────────
// The service_role key lives ONLY inside the Edge Function on the server.
// This replaces the old getAdminClient() pattern.

async function callManageUsers(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("manage-users", {
    body,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────

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

  // ── fetchData — uses normal anon client (RLS now scopes results) ──────────
  const fetchData = async () => {
    try {
      setLoading(true);

      // RLS policies (Phase 1.5) ensure each user only sees their own companies
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, name, role, assigned_companies, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      let usersData: UserProfile[] = (data as any[]) || [];

      // Client-side filter as a second layer (belt-and-suspenders)
      if (!isSuperAdmin) {
        const myCompanyIds = currentUser?.assigned_companies || [];
        usersData = usersData.filter((u) => {
          if (u.role === "super_admin") return false;
          return (u.assigned_companies || []).some((id) =>
            myCompanyIds.includes(id)
          );
        });
      }

      setUsers(usersData);

      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (companiesError) throw companiesError;

      if (isSuperAdmin) {
        setCompanies(companiesData || []);
      } else {
        const myIds = currentUser?.assigned_companies || [];
        setCompanies(
          (companiesData || []).filter((c) => myIds.includes(c.id))
        );
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

  // ── CREATE ────────────────────────────────────────────────────────────────
  const handleCreateUser = async () => {
    // Client-side validation
    if (!formData.email || !formData.password || !formData.name) {
      toast.error("Name, email and password are required");
      return;
    }
    if (formData.password.length < 10) {
      toast.error("Password must be at least 10 characters");
      return;
    }

    try {
      await callManageUsers({
        action: "create",
        payload: {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: formData.role,
          assignedCompanies: formData.assignedCompanies,
        },
      });
      toast.success("User created successfully");
      setIsAddDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (e: any) {
      toast.error(e.message || "Failed to create user");
    }
  };

  // ── UPDATE ────────────────────────────────────────────────────────────────
  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    try {
      await callManageUsers({
        action: "update",
        id: selectedUser.id,
        payload: {
          name: formData.name,
          role: formData.role,
          assignedCompanies: formData.assignedCompanies,
        },
      });
      toast.success("User updated successfully");
      setIsEditDialogOpen(false);
      await fetchData();
    } catch (e: any) {
      toast.error("Failed to update user: " + e.message);
    }
  };

  // ── DELETE ────────────────────────────────────────────────────────────────
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      await callManageUsers({ action: "delete", id: selectedUser.id });
      toast.success("User deleted successfully");
      setIsDeleteDialogOpen(false);
      await fetchData();
    } catch (e: any) {
      toast.error("Failed to delete user: " + e.message);
    }
  };

  // ── DOWNLOAD TEMPLATE ─────────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const headers = ["email", "password", "name", "role", "assigned_companies"];
    // Note: never use real passwords in CSV templates
    const exampleRow = [
      "auditor1@example.com",
      "ChangeMe123!",   // placeholder — admin must update before use
      "John Auditor",
      "auditor",
      '"Company A, Company B"',
    ];

    const note =
      "# IMPORTANT: Replace the example password before use. Never store real passwords in CSV files.\n";
    const csvContent =
      note + headers.join(",") + "\n" + exampleRow.join(",");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "user_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  };

  // ── BULK IMPORT ───────────────────────────────────────────────────────────
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

        // Company lookup — only companies this admin can access
        const companyLookup = new Map(
          companies.map((c) => [c.name.toLowerCase().trim(), c.id])
        );

        // Pre-flight validation
        const invalidRows: string[] = [];
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row.email || !row.password) {
            invalidRows.push(`Row ${i + 1}: Missing email or password`);
            continue;
          }
          if ((row.password?.length ?? 0) < 10) {
            invalidRows.push(
              `Row ${i + 1} (${row.email}): Password must be at least 10 characters`
            );
            continue;
          }
          const rawNames = row["assigned companies"] || row["assigned_companies"] || "";
          const names = rawNames.split(",").map((n: string) => n.trim()).filter(Boolean);
          if (names.length === 0) {
            invalidRows.push(
              `Row ${i + 1} (${row.email}): Must have at least one assigned company`
            );
          } else {
            for (const name of names) {
              if (!companyLookup.has(name.toLowerCase())) {
                invalidRows.push(
                  `Row ${i + 1} (${row.email}): Company "${name}" is invalid or you lack permission`
                );
              }
            }
          }
        }

        if (invalidRows.length > 0) {
          toast.error("Import Aborted: Validation Failed", {
            description:
              invalidRows[0] +
              (invalidRows.length > 1
                ? ` (+${invalidRows.length - 1} more errors)`
                : ""),
            duration: 5000,
          });
          setIsImporting(false);
          return;
        }

        // Build payload and send to Edge Function
        const payload = rows.map((row: any) => {
          const rawNames =
            row["assigned companies"] || row["assigned_companies"] || "";
          const companyIds = rawNames
            .split(",")
            .map((n: string) => companyLookup.get(n.trim().toLowerCase()))
            .filter(Boolean) as string[];
          return {
            email: row.email?.trim(),
            password: row.password?.trim(),
            name: row.name?.trim() || row.email?.split("@")[0],
            role: (row.role?.trim().toLowerCase() || "auditor") as string,
            assignedCompanies: companyIds,
          };
        });

        const result = await callManageUsers({
          action: "bulkCreate",
          payload,
        });

        const success = result?.success ?? 0;
        const errors: string[] = result?.errors ?? [];
        toast.success(
          `Imported ${success} user(s)` +
            (errors.length ? `, ${errors.length} failed` : "")
        );
        if (errors.length) console.warn("Import errors:", errors);

        setIsImportDialogOpen(false);
        setImportFile(null);
        await fetchData();
      } catch (e: any) {
        console.error("Import Error:", e);
        toast.error("Import failed: " + e.message);
      } finally {
        setIsImporting(false);
      }
    };

    reader.readAsText(importFile);
  };

  const filteredUsers = users.filter((user) => {
    if (companyFilter === "all") return true;
    return user.assigned_companies?.includes(companyFilter);
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppLayout showSidebar={false}>
      <div className="space-y-6 max-w-7xl mx-auto pt-6">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                User Management
              </h1>
              <p className="text-sm text-gray-500">
                Create and manage user access
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsImportDialogOpen(true)}
              className="bg-white"
            >
              <UploadCloud className="w-4 h-4 mr-2 text-indigo-600" />
              Import CSV
            </Button>
            <Button
              onClick={() => {
                resetForm();
                setIsAddDialogOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>

        {/* Security notice banner */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          <ShieldAlert className="h-4 w-4 shrink-0 text-green-600" />
          All user operations are secured via server-side Edge Functions. No service key is exposed in the browser.
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
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
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
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-gray-500"
                    >
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            {user.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="capitalize bg-indigo-50 text-indigo-700 border-indigo-100"
                        >
                          {user.role.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.assigned_companies &&
                          user.assigned_companies.length > 0 ? (
                            user.assigned_companies.map((cid) => {
                              const cName = companies.find(
                                (c) => c.id === cid
                              )?.name;
                              return cName ? (
                                <span
                                  key={cid}
                                  className="text-xs bg-gray-100 px-2 py-1 rounded"
                                >
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
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedUser(user);
                              setFormData({
                                name: user.name,
                                email: user.email,
                                password: "",
                                role: user.role as any,
                                assignedCompanies:
                                  user.assigned_companies || [],
                              });
                              setIsEditDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 text-gray-500" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
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

        {/* ── Add User Dialog ─────────────────────────────────────────────── */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="john@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Minimum 10 characters"
                />
                {formData.password.length > 0 &&
                  formData.password.length < 10 && (
                    <p className="text-xs text-red-500">
                      Password must be at least 10 characters
                    </p>
                  )}
              </div>
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v: any) =>
                    setFormData({ ...formData, role: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auditor">Auditor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    {isSuperAdmin && (
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Assigned Companies</Label>
                <div className="border rounded p-2 max-h-32 overflow-y-auto space-y-1">
                  {companies.map((c) => (
                    <div key={c.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.assignedCompanies.includes(c.id)}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            assignedCompanies: checked
                              ? [...formData.assignedCompanies, c.id]
                              : formData.assignedCompanies.filter(
                                  (id) => id !== c.id
                                ),
                          });
                        }}
                      />
                      <span className="text-sm">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateUser}
                className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto"
              >
                Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Edit User Dialog ────────────────────────────────────────────── */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(v: any) =>
                    setFormData({ ...formData, role: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auditor">Auditor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    {isSuperAdmin && (
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Assigned Companies</Label>
                <div className="border rounded p-2 max-h-32 overflow-y-auto space-y-1">
                  {companies.map((c) => (
                    <div key={c.id} className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.assignedCompanies.includes(c.id)}
                        onCheckedChange={(checked) => {
                          setFormData({
                            ...formData,
                            assignedCompanies: checked
                              ? [...formData.assignedCompanies, c.id]
                              : formData.assignedCompanies.filter(
                                  (id) => id !== c.id
                                ),
                          });
                        }}
                      />
                      <span className="text-sm">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleUpdateUser}
                className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto"
              >
                Update User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Import Dialog ───────────────────────────────────────────────── */}
        <Dialog
          open={isImportDialogOpen}
          onOpenChange={setIsImportDialogOpen}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Bulk Import Users</DialogTitle>
              <DialogDescription>
                Create multiple users at once by uploading a CSV file.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Security note */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                <span>
                  The template contains a placeholder password. Replace it with
                  real passwords before importing. Never store real credentials
                  in CSV files.
                </span>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                  <p className="font-medium text-gray-900 mb-1">
                    Need the exact format?
                  </p>
                  <p>Download the CSV template with example data.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="shrink-0 bg-white"
                >
                  <Download className="w-4 h-4 mr-2 text-indigo-600" />
                  Template
                </Button>
              </div>

              <div className="grid gap-2">
                <Label>Upload your completed CSV</Label>
                <Input
                  type="file"
                  accept=".csv"
                  className="cursor-pointer"
                  onChange={(e) =>
                    setImportFile(e.target.files?.[0] || null)
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsImportDialogOpen(false);
                  setImportFile(null);
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!importFile || isImporting}
                onClick={handleImport}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isImporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4 mr-2" />
                )}
                {isImporting ? "Importing..." : "Start Import"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Confirmation Dialog ──────────────────────────────────── */}
        <Dialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <Trash className="h-5 w-5" />
                <DialogTitle>Delete User</DialogTitle>
              </div>
              <DialogDescription>
                Are you sure you want to completely remove{" "}
                <strong>{selectedUser?.name}</strong> from the system? This
                action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteUser}>
                Yes, Delete User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
};

export default UserManagement;