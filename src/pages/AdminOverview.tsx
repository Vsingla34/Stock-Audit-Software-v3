import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileChartColumn, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  ArrowLeft,
  CalendarDays,
  User
} from "lucide-react";
import { useCompany } from "@/context/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface AssignmentStats {
  assignmentId: number;
  locationName: string;
  status: string;
  scheduledDate: string;
  auditorNames: string[];
  totalItems: number;
  auditedItems: number;
  matched: number;
  discrepancies: number;
}

const AdminOverview = () => {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  
  const [assignmentStats, setAssignmentStats] = useState<AssignmentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    if (selectedCompanyId) {
      fetchOverviewData();
    }
  }, [selectedCompanyId]);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Company Name
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", selectedCompanyId)
        .single();
      if (company) setCompanyName(company.name);

      // 2. Fetch Active Assignments (Not finalized)
      const { data: assignments, error: assignError } = await supabase
        .from("assignments")
        .select(`
          id,
          status,
          scheduled_date,
          auditor_ids,
          locations (name)
        `)
        .eq("company_id", selectedCompanyId)
        .neq("status", "finalized");

      if (assignError) throw assignError;

      // 3. Fetch Inventory Items for this company
      // We need to aggregate them by assignment_id
      const { data: items, error: itemsError } = await supabase
        .from("inventory_items")
        .select("id, status, assignment_id, system_quantity, physical_quantity")
        .eq("company_id", selectedCompanyId);

      if (itemsError) throw itemsError;

      // 4. Fetch Auditor Names
      // Collect all auditor IDs first
      const allAuditorIds = new Set<string>();
      assignments?.forEach((a: any) => {
        const ids = Array.isArray(a.auditor_ids) ? a.auditor_ids : [];
        ids.forEach((id: string) => allAuditorIds.add(id));
      });

      let auditorMap = new Map<string, string>();
      if (allAuditorIds.size > 0) {
        const { data: auditors } = await supabase
          .from("user_profiles")
          .select("id, name, email")
          .in("id", Array.from(allAuditorIds));
        
        auditors?.forEach(aud => {
          auditorMap.set(aud.id, aud.name || aud.email);
        });
      }

      // 5. Aggregate Data
      const stats: AssignmentStats[] = (assignments || []).map((a: any) => {
        // Filter items for this assignment
        const assignmentItems = (items || []).filter(item => item.assignment_id === a.id);
        
        const totalItems = assignmentItems.length;
        const auditedItems = assignmentItems.filter(i => i.status && i.status !== 'pending').length;
        const matched = assignmentItems.filter(i => i.status === 'matched').length;
        const discrepancies = assignmentItems.filter(i => i.status === 'discrepancy').length;

        // Resolve Auditor Names
        const ids = Array.isArray(a.auditor_ids) ? a.auditor_ids : [];
        const names = ids.map((id: string) => auditorMap.get(id) || "Unknown");

        return {
          assignmentId: a.id,
          locationName: a.locations?.name || "Unknown Location",
          status: a.status,
          scheduledDate: a.scheduled_date,
          auditorNames: names,
          totalItems,
          auditedItems,
          matched,
          discrepancies
        };
      });

      setAssignmentStats(stats);

    } catch (error) {
      console.error("Error loading admin overview:", error);
    } finally {
      setLoading(false);
    }
  };

  const overallStats = {
    totalItems: assignmentStats.reduce((sum, a) => sum + a.totalItems, 0),
    auditedItems: assignmentStats.reduce((sum, a) => sum + a.auditedItems, 0),
    matched: assignmentStats.reduce((sum, a) => sum + a.matched, 0),
    discrepancies: assignmentStats.reduce((sum, a) => sum + a.discrepancies, 0),
  };

  const overallProgress = overallStats.totalItems > 0 
    ? Math.round((overallStats.auditedItems / overallStats.totalItems) * 100)
    : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 shadow-none border-blue-200">Active</Badge>;
      case "pending": return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 shadow-none border-yellow-200">Pending</Badge>;
      case "submitted": return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 shadow-none border-orange-200">Submitted</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AppLayout showSidebar={false}>
      <div className="space-y-6">
        
        {/* Header with Back Button */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)} 
            className="p-0 hover:bg-transparent"
          >
            <ArrowLeft className="h-6 w-6 text-gray-500 hover:text-gray-900" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Admin Overview</h1>
            <p className="text-gray-500">
              Live audit progress for {companyName || "selected company"}
            </p>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="bg-indigo-50 border-indigo-100 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-indigo-900">Total Items</CardTitle>
              <Layers className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{overallStats.totalItems}</div>
              <p className="text-xs text-indigo-700">In active assignments</p>
            </CardContent>
          </Card>

          <Card className="bg-violet-50 border-violet-100 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-violet-900">Audited Items</CardTitle>
              <Activity className="h-4 w-4 text-violet-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{overallStats.auditedItems}</div>
              <div className="flex items-center gap-2 mt-1">
                <Progress value={overallProgress} className="h-1.5 w-16 bg-violet-200 [&>*]:bg-violet-600" />
                <p className="text-xs text-violet-700">{overallProgress}% done</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-100 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-green-900">Matched Items</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{overallStats.matched}</div>
              <p className="text-xs text-green-700">
                {overallStats.auditedItems > 0
                  ? Math.round((overallStats.matched / overallStats.auditedItems) * 100)
                  : 0}% match rate
              </p>
            </CardContent>
          </Card>

          <Card className="bg-red-50 border-red-100 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-red-900">Discrepancies</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overallStats.discrepancies}</div>
              <p className="text-xs text-red-700">
                {overallStats.auditedItems > 0
                  ? Math.round((overallStats.discrepancies / overallStats.auditedItems) * 100)
                  : 0}% with issues
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Assignment Progress Table */}
        <Card className="shadow-sm border-gray-200">
          <CardHeader className="border-b border-gray-100 bg-gray-50/50">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <FileChartColumn className="h-5 w-5 text-indigo-600" />
              <span>Assignment Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="font-semibold text-gray-700">Location</TableHead>
                  <TableHead className="font-semibold text-gray-700">Auditors</TableHead>
                  <TableHead className="font-semibold text-gray-700">Date</TableHead>
                  <TableHead className="font-semibold text-gray-700">Status</TableHead>
                  <TableHead className="font-semibold text-gray-700 text-center">Audited / Total</TableHead>
                  <TableHead className="font-semibold text-gray-700">Discrepancies</TableHead>
                  <TableHead className="font-semibold text-gray-700">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                      Loading data...
                    </TableCell>
                  </TableRow>
                ) : assignmentStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                      No active assignments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  assignmentStats.map((stat) => {
                    const progressPercentage = stat.totalItems > 0
                      ? Math.round((stat.auditedItems / stat.totalItems) * 100)
                      : 0;
                    
                    return (
                      <TableRow key={stat.assignmentId} className="hover:bg-indigo-50/30 transition-colors">
                        <TableCell className="font-medium text-gray-900">
                          {stat.locationName}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {stat.auditorNames.length > 0 ? (
                              stat.auditorNames.map((name, i) => (
                                <div key={i} className="flex items-center gap-1 text-xs text-gray-600">
                                  <User className="h-3 w-3 text-gray-400" /> {name}
                                </div>
                              ))
                            ) : (
                              <span className="text-gray-400 text-xs italic">Unassigned</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-gray-600 text-sm">
                            <CalendarDays className="h-3 w-3" />
                            {stat.scheduledDate ? format(new Date(stat.scheduledDate), "MMM dd") : "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(stat.status)}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          <span className="text-gray-900">{stat.auditedItems}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className="text-gray-500">{stat.totalItems}</span>
                        </TableCell>
                        <TableCell className={stat.discrepancies > 0 ? "text-red-600 font-bold" : "text-gray-400"}>
                          {stat.discrepancies}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Progress 
                              value={progressPercentage} 
                              className="h-2 w-full max-w-[80px] bg-gray-100 [&>*]:bg-indigo-600" 
                            />
                            <span className="text-xs font-medium text-gray-600 w-8 text-right">{progressPercentage}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminOverview;