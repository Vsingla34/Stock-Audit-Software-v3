import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Shield, Building2, CalendarDays } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Separator } from "@/components/ui/separator";

interface UserProfileDetails {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  assigned_companies: string[] | null;
  // assigned_locations removed
}

const Profile = () => {
  const { user } = useUser();
  const [profile, setProfile] = useState<UserProfileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyNames, setCompanyNames] = useState<string[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        // 1. Fetch Profile (Removed assigned_locations to fix 400 Error)
        const { data, error } = await supabase
          .from("user_profiles")
          .select("id, name, email, role, created_at, assigned_companies")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        setProfile(data);

        // 2. Fetch Company Names if assigned
        if (data.assigned_companies && data.assigned_companies.length > 0) {
          const { data: companies, error: companyError } = await supabase
            .from("companies")
            .select("name")
            .in("id", data.assigned_companies);
          
          if (!companyError && companies) {
            setCompanyNames(companies.map(c => c.name));
          }
        }

      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-full bg-red-100 p-3">
            <User className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Profile not found</h2>
          <p className="text-gray-500">Could not load user information.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Profile</h1>
          <p className="text-gray-500">Manage your account settings and preferences.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Main Profile Card */}
          <Card className="shadow-sm border-gray-200 md:col-span-2 lg:col-span-1">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="text-gray-900">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">
                <Avatar className="h-24 w-24 border-4 border-white shadow-lg ring-1 ring-gray-100">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${profile.name}`} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xl">
                    {profile.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="space-y-4 flex-1 w-full text-center sm:text-left">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
                    <p className="text-sm text-gray-500 flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                      <Mail className="h-3.5 w-3.5" />
                      {profile.email}
                    </p>
                  </div>

                  <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                    <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-100 px-3 py-1">
                      <Shield className="mr-1.5 h-3.5 w-3.5" />
                      {profile.role.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-gray-600 border-gray-200 px-3 py-1">
                      <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                      Joined {format(new Date(profile.created_at), 'MMMM yyyy')}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Access & Assignments Card */}
          <Card className="shadow-sm border-gray-200 md:col-span-2 lg:col-span-1">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100">
              <CardTitle className="text-gray-900">Access & Assignments</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              {/* Companies Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  Assigned Companies
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  {companyNames.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {companyNames.map((name, i) => (
                        <Badge key={i} variant="outline" className="bg-white hover:bg-white text-gray-700 border-gray-200">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No specific companies assigned.</p>
                  )}
                </div>
              </div>

              <Separator className="bg-gray-100" />

              {/* Note about Locations */}
              <div className="rounded-md bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Shield className="h-5 w-5 text-blue-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">Access Control</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        Your location access is determined dynamically based on your active assignments and company roles. 
                        Check the <strong>Assignments</strong> page to see your current tasks.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;