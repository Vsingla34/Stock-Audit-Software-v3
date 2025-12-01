import { AppLayout } from "@/components/layout/AppLayout";
import { useInventory } from "@/context/InventoryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileChartColumn, Building, Activity, CheckCircle2, AlertTriangle, Layers } from "lucide-react";

const AdminOverview = () => {
  const { locations, getLocationSummary } = useInventory();
  
  
  const locationSummaries = locations.map(location => ({
    location,
    summary: getLocationSummary(location.name)
  }));

  




  
  const overallStats = {
    totalItems: locationSummaries.reduce((sum, loc) => sum + loc.summary.totalItems, 0),
    auditedItems: locationSummaries.reduce((sum, loc) => sum + loc.summary.auditedItems, 0),
    matched: locationSummaries.reduce((sum, loc) => sum + loc.summary.matched, 0),
    discrepancies: locationSummaries.reduce((sum, loc) => sum + loc.summary.discrepancies, 0),
  };

  const overallProgress = overallStats.totalItems > 0 
    ? Math.round((overallStats.auditedItems / overallStats.totalItems) * 100)
    : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Admin Overview</h1>
          <p className="text-gray-500">Monitor audit progress across all locations</p>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card className="bg-indigo-50 border-indigo-100 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-indigo-900">Total Items</CardTitle>
              <Layers className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{overallStats.totalItems}</div>
              <p className="text-xs text-indigo-700">Across all locations</p>
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

        <Card className="shadow-sm border-gray-200">
          <CardHeader className="border-b border-gray-100 bg-gray-50/50">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <FileChartColumn className="h-5 w-5 text-indigo-600" />
              <span>Location Audit Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="font-semibold text-gray-700">Location</TableHead>
                  <TableHead className="font-semibold text-gray-700">Total Items</TableHead>
                  <TableHead className="font-semibold text-gray-700">Audited</TableHead>
                  <TableHead className="font-semibold text-gray-700">Matched</TableHead>
                  <TableHead className="font-semibold text-gray-700">Discrepancies</TableHead>
                  <TableHead className="font-semibold text-gray-700">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locationSummaries.map(({ location, summary }) => {
                  const progressPercentage = summary.totalItems > 0
                    ? Math.round((summary.auditedItems / summary.totalItems) * 100)
                    : 0;
                  
                  return (
                    <TableRow key={location.id} className="hover:bg-indigo-50/30 transition-colors">
                      <TableCell className="font-medium flex items-center gap-2 text-gray-900">
                        <Building className="h-4 w-4 text-gray-400" />
                        {location.name}
                      </TableCell>
                      <TableCell>{summary.totalItems}</TableCell>
                      <TableCell>{summary.auditedItems}</TableCell>
                      <TableCell className="text-green-600 font-medium">{summary.matched}</TableCell>
                      <TableCell className={summary.discrepancies > 0 ? "text-red-600 font-medium" : "text-gray-500"}>
                        {summary.discrepancies}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Progress 
                            value={progressPercentage} 
                            className="h-2 w-full max-w-[100px] bg-gray-100 [&>*]:bg-indigo-600" 
                          />
                          <span className="text-xs font-medium text-gray-600 w-8 text-right">{progressPercentage}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminOverview;