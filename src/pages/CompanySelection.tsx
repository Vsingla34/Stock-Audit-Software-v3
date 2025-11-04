import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Company {
  id: string;
  name: string;
  address: string;
  is_active: boolean;
}

const CompanySelection = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');
  const [assignedCompanies, setAssignedCompanies] = useState<string[]>([]);

  useEffect(() => {
    fetchUserAndCompanies();
  }, []);

  const fetchUserAndCompanies = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role, assigned_companies')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      setUserRole(profile.role);
      setAssignedCompanies(profile.assigned_companies || []);

      // Fetch companies based on role
      let query = supabase
        .from('companies')
        .select('*')
        .eq('is_active', true)
        .order('name');

      // If not admin, filter by assigned companies
      if (profile.role !== 'admin' && profile.assigned_companies?.length > 0) {
        query = query.in('id', profile.assigned_companies);
      }

      const { data: companiesData, error: companiesError } = await query;

      if (companiesError) throw companiesError;

      setCompanies(companiesData || []);
    } catch (error: any) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySelect = (companyId: string) => {
    // Store selected company in session storage
    sessionStorage.setItem('selectedCompanyId', companyId);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading companies...</p>
        </div>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">No Companies Available</CardTitle>
            <CardDescription className="text-center">
              {userRole === 'admin' 
                ? 'No companies have been created yet. Please create a company first.'
                : 'You do not have access to any companies. Please contact your administrator.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userRole === 'admin' && (
              <Button 
                className="w-full" 
                onClick={() => navigate('/add-company')}
              >
                <Building2 className="mr-2 h-4 w-4" />
                Create Company
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Select Company
          </h1>
          <p className="text-muted-foreground">
            Choose a company to access the inventory audit system
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <Card 
              key={company.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary"
              onClick={() => handleCompanySelect(company.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Building2 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{company.name}</CardTitle>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="line-clamp-2">
                  {company.address || 'No address provided'}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {userRole === 'admin' && (
          <div className="mt-8 text-center">
            <Button 
              variant="outline" 
              onClick={() => navigate('/add-company')}
            >
              <Building2 className="mr-2 h-4 w-4" />
              Add New Company
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanySelection;