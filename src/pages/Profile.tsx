
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserProfileRow {
  id: string;
  email: string;
  name: string;
  role: "admin" | "auditor" | "client";
  assigned_companies: string[] | null;
  assigned_locations: string[] | null;
}

export default function Profile() {
  const [profile, setProfile] = useState<UserProfileRow | null>(null);
  const [companyNames, setCompanyNames] = useState<string>("All Companies");
  const [locationNames, setLocationNames] = useState<string>("All Locations");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) return;

        const { data, error } = await supabase
          .from("user_profiles")
          .select(
            "id, email, name, role, assigned_companies, assigned_locations"
          )
          .eq("id", user.id)
          .single();

        if (error) throw error;

        const profileRow = data as UserProfileRow;
        setProfile(profileRow);


        if (
          profileRow.role === "admin" ||
          !profileRow.assigned_companies ||
          profileRow.assigned_companies.length === 0
        ) {
          setCompanyNames("All Companies");
        } else {
          const { data: companyData, error: companyError } = await supabase
            .from("companies")
            .select("id, name")
            .in("id", profileRow.assigned_companies);

          if (companyError) throw companyError;

          const names =
            companyData?.map((c: any) => c.name).join(", ") ||
            "Assigned companies";
          setCompanyNames(names);
        }


        if (
          profileRow.role === "admin" ||
          !profileRow.assigned_locations ||
          profileRow.assigned_locations.length === 0
        ) {
          setLocationNames("All Locations");
        } else {
          const { data: locationData, error: locationError } = await supabase
            .from("locations")
            .select("id, name")
            .in("id", profileRow.assigned_locations);

          if (locationError) throw locationError;

          const names =
            locationData?.map((l: any) => l.name).join(", ") ||
            "Assigned locations";
          setLocationNames(names);
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[400px]">
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[400px]">
          <p className="text-muted-foreground">Profile not found.</p>
        </div>
      </AppLayout>
    );
  }

  const niceRoleLabel =
    profile.role === "admin"
      ? "Admin"
      : profile.role === "client"
      ? "Client"
      : "Inventory Auditor";

  const accessText =
    profile.role === "admin"
      ? "As an admin, you can manage all companies, locations, users and reports."
      : profile.role === "client"
      ? "As a client, you can view analytics, reports and audit results for your companies."
      : "As an auditor, you can conduct stock audits and view reports for your assigned locations.";

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-1">
          User Profile
        </h1>
        <p className="text-muted-foreground mb-6">
          View and manage your account information
        </p>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
           
           
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Name
                  </p>
                  <p className="text-sm">{profile.name}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Role
                  </p>
                  <Badge
                    variant={
                      profile.role === "admin"
                        ? "default"
                        : profile.role === "client"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {niceRoleLabel}
                  </Badge>
                </div>
              </div>


              <div className="space-y-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Email
                  </p>
                  <p className="text-sm">{profile.email}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Company
                  </p>
                  <p className="text-sm">{companyNames}</p>
                </div>

                
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Locations
                  </p>
                  <p className="text-sm">{locationNames}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                Access
              </p>
              <p className="text-sm text-muted-foreground">{accessText}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
