import { useState, useEffect } from "react";
import { useUser } from "@/context/UserContext";
import { useInventory } from "@/context/InventoryContext";
import { useCompany } from "@/context/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUserAccess } from "@/hooks/useUserAccess";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export const UserProfile = () => {
  const { currentUser, updateUser } = useUser();
  const { locations } = useInventory();
  const { selectedCompanyId } = useCompany();
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const { userRoleDisplay } = useUserAccess();

  const [formData, setFormData] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
  });

  // --- Company name for the currently selected company ---
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);

  useEffect(() => {
    const fetchCompany = async () => {
      if (!selectedCompanyId) {
        setCompanyName(null);
        return;
      }
      try {
        setCompanyLoading(true);
        const { data, error } = await supabase
          .from("companies")
          .select("name")
          .eq("id", selectedCompanyId)
          .single();

        if (error) {
          console.error("Error fetching company:", error);
          setCompanyName(null);
        } else {
          setCompanyName(data?.name ?? null);
        }
      } catch (err) {
        console.error("Error fetching company:", err);
        setCompanyName(null);
      } finally {
        setCompanyLoading(false);
      }
    };

    fetchCompany();
  }, [selectedCompanyId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = () => {
    if (!currentUser) return;

    updateUser({
      ...currentUser,
      name: formData.name,
      email: formData.email,
    });

    toast({
      title: "Profile updated",
      description: "Your profile information has been updated",
    });

    setIsEditing(false);
  };

  if (!currentUser) return null;

  const assignedLocations = currentUser.assignedLocations || [];
  const canEdit = currentUser.role !== "client";

  const assignedLocationNames =
    locations?.filter((loc) => assignedLocations.includes(loc.id)) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>User Profile</CardTitle>
            <CardDescription>
              View and manage your profile information
            </CardDescription>
          </div>
          {!isEditing && canEdit && (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Edit Profile
            </Button>
          )}
        </div>
      </CardHeader>

      {currentUser.role === "client" && (
        <div className="px-6">
          <Alert className="border-amber-200 bg-amber-50 mb-4">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <AlertTitle className="text-amber-700">Client Account</AlertTitle>
            <AlertDescription className="text-amber-600">
              As a client user, you have view-only access to audit data for your
              assigned locations.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <CardContent>
        {isEditing && canEdit ? (
          // --------- EDIT MODE ----------
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Name
                </h3>
                <Input
                  className="mt-1"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Email
                </h3>
                <Input
                  className="mt-1"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled
                />
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Company
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {companyLoading
                    ? "Loading..."
                    : companyName || "No company selected"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          // --------- VIEW MODE ----------
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Name
                </h3>
                <p className="mt-1">{currentUser.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Email
                </h3>
                <p className="mt-1">{currentUser.email}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Role
                </h3>
                <Badge
                  className="mt-1"
                  variant={
                    currentUser.role === "admin"
                      ? "default"
                      : currentUser.role === "auditor"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {userRoleDisplay()}
                </Badge>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">
                  Company
                </h3>
                <p className="mt-1">
                  {companyLoading
                    ? "Loading..."
                    : companyName || "No company selected"}
                </p>
              </div>
            </div>

            {currentUser.role !== "admin" && assignedLocationNames.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  Assigned Locations
                </h3>
                <div className="space-y-1">
                  {assignedLocationNames.map((loc) => (
                    <p key={loc.id} className="text-sm">
                      {loc.name}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">
                Access
              </h3>
              {currentUser.role === "admin" && (
                <p className="text-sm">
                  As an admin, you have access to all locations and features.
                </p>
              )}
              {currentUser.role === "auditor" && (
                <p className="text-sm">
                  As an auditor, you can conduct stock audits and view reports
                  for your assigned locations.
                </p>
              )}
              {currentUser.role === "client" && (
                <p className="text-sm">
                  As a client, you have view-only access to audit results for
                  your assigned locations.
                </p>
              )}
            </div>

            {currentUser.role === "client" && currentUser.companyId && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  Company ID
                </h3>
                <p className="text-sm">{currentUser.companyId}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {isEditing && canEdit && (
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdateProfile}>Save Changes</Button>
        </CardFooter>
      )}
    </Card>
  );
};
