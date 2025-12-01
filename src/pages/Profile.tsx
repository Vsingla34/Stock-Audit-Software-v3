import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Mail, Building2, MapPin, Shield, CheckCircle2, Loader2 } from "lucide-react";

interface UserProfileRow {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "admin" | "auditor" | "client";
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
          profileRow.role === "super_admin" || 
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
          profileRow.role === "super_admin" || 
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
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
          <p className="text-gray-500 font-medium">Loading profile...</p>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-500">Profile not found.</p>
        </div>
      </AppLayout>
    );
  }

  
  const niceRoleLabel =
    profile.role === "super_admin"
      ? "Super Administrator"
      : profile.role === "admin"
      ? "Admin"
      : profile.role === "client"
      ? "Client"
      : "Inventory Auditor";

  
  const accessText =
    profile.role === "super_admin"
      ? "As a Super Admin, you have full system access, including creating companies and managing all users."
      : profile.role === "admin"
      ? "As an admin, you can manage users, locations, and reports for your assigned companies."
      : profile.role === "client"
      ? "As a client, you can view analytics, reports and audit results for your companies."
      : "As an auditor, you can conduct stock audits and view reports for your assigned locations.";

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            User Profile
          </h1>
          <p className="text-gray-500">
            View and manage your account information
          </p>
        </div>

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 pb-8">
            <div className="flex items-center gap-5">
                <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-white shadow-md">
                    <User className="h-8 w-8 text-indigo-600" />
                </div>
                <div>
                    <CardTitle className="text-2xl font-bold text-gray-900">{profile.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600 font-medium">{profile.email}</span>
                    </div>
                </div>
            </div>
          </CardHeader>

          <CardContent className="pt-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-indigo-600" /> Role
                </label>
                <div>
                  <Badge
                    variant="outline"
                    className={`
                      px-3 py-1 text-sm font-medium
                      ${profile.role === "super_admin" ? "bg-purple-50 text-purple-700 border-purple-200" : ""}
                      ${profile.role === "admin" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : ""}
                      ${profile.role === "client" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}
                      ${profile.role === "auditor" ? "bg-blue-50 text-blue-700 border-blue-200" : ""}
                    `}
                  >
                    {niceRoleLabel}
                  </Badge>
                </div>
              </div>

              
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-indigo-600" /> Assigned Company
                </label>
                <p className="text-sm text-gray-900 font-medium bg-gray-50 p-2.5 rounded-md border border-gray-100">
                    {companyNames}
                </p>
              </div>

              
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-indigo-600" /> Assigned Locations
                </label>
                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-md border border-gray-100">
                    {locationNames}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-indigo-50 p-4 border border-indigo-100">
                <div className="flex items-start gap-3">
                    <div className="p-1 bg-indigo-100 rounded-full">
                        <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-indigo-900">Access Level Permissions</h4>
                        <p className="text-sm text-indigo-700 mt-1 leading-relaxed">
                            {accessText}
                        </p>
                    </div>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}