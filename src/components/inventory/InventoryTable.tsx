import { useInventory } from "@/context/InventoryContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { useUser } from "@/context/UserContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useMemo, useCallback } from "react";

interface InventoryTableProps {
  selectedLocation?: string;
}

export const InventoryTable = ({ selectedLocation }: InventoryTableProps) => {
  const { itemMaster, auditedItems, locations } = useInventory();
  const { currentUser } = useUser();
  const { accessibleLocations } = useUserAccess();


  const userLocations = useMemo(() => accessibleLocations(), [accessibleLocations]);

  // Memoized combined table data with real-time updates
const allTableData = useMemo(() => {
  return itemMaster
    .filter(item => item.location !== '') // EXCLUDE blueprints (empty location)
    .map(item => {
      const auditedItem = auditedItems.find(a => a.id === item.id && a.location === item.location);
      if (auditedItem) {
        return {
          ...item,
          physicalQuantity: auditedItem.physicalQuantity,
          status: auditedItem.status,
          lastAudited: auditedItem.lastAudited,
        };
      }
      return {
        ...item,
        physicalQuantity: 0,
        status: "pending" as const,
        lastAudited: undefined,
        auditedBy: undefined
      };
    });
}, [itemMaster, auditedItems]);

  // Memoized filtered data
  const filteredData = useMemo(() => {
    if (currentUser?.role === "admin" && !selectedLocation) {
      return allTableData;
    } else if (selectedLocation) {
      const locationObj = locations.find(loc => loc.id === selectedLocation);
      if (locationObj) {
        return allTableData.filter(item => item.location === locationObj.name);
      }
    } else if (currentUser?.role !== "admin") {
      const accessibleLocationNames = userLocations.map(loc => loc.name);
      return allTableData.filter(item => accessibleLocationNames.includes(item.location));
    }

    return currentUser?.role === "admin" ? allTableData : [];
  }, [allTableData, selectedLocation, locations, currentUser?.role, userLocations]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const total = filteredData.length;
    const pending = filteredData.filter(item => item.status === "pending").length;
    const matched = filteredData.filter(item => item.status === "matched").length;
    const discrepancies = filteredData.filter(item => item.status === "discrepancy").length;
    const totalScanned = matched + discrepancies;
    const progressPercentage = total > 0 ? Math.round((totalScanned / total) * 100) : 0;

    return {
      total,
      pending,
      matched,
      discrepancies,
      totalScanned,
      progressPercentage
    };
  }, [filteredData]);

  const renderStatus = useCallback((status: string | undefined, systemQty: number, physicalQty: number) => {
    switch(status) {
      case "matched":
        return (
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
              Matched
            </Badge>
          </div>
        );
      case "discrepancy":
        return (
          <div className="flex items-center gap-2">

            <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
              Discrepancy
            </Badge>

          </div>
        );
      default:
        return (
          <div className="flex items-center">
            <Clock className="h-4 w-4 text-gray-400 mr-1" />
            <Badge variant="outline" className="text-gray-600">
              Pending
            </Badge>
          </div>
        );
    }
  }, []);

  const formatDate = useCallback((dateString: string | undefined) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd MMM yyyy HH:mm");
    } catch {
      return "-";
    }
  }, []);

  const getRowClassName = useCallback((status: string | undefined, systemQty: number, physicalQty: number) => {
    switch(status) {
      case "discrepancy":
        const isOverCount = physicalQty > systemQty;
        return isOverCount ? "bg-orange-50 hover:bg-orange-100" : "bg-red-50 hover:bg-red-100";
      case "matched":
        return "bg-green-50 hover:bg-green-100";
      default:
        return "hover:bg-gray-50";
    }
  }, []);

  const getQuantityCellClass = useCallback((status: string | undefined, systemQty: number, physicalQty: number) => {
    if (status === "discrepancy") {
      return physicalQty > systemQty ? "text-orange-600 font-semibold" : "text-red-600 font-semibold";
    }
    if (status === "matched") {
      return "text-green-600 font-semibold";
    }
    return "";
  }, []);

  return (
    <div className="space-y-4">


      {/* Inventory Table */}
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold">SKU</TableHead>
              <TableHead className="font-semibold">Name</TableHead>
              <TableHead className="font-semibold">Category</TableHead>
              <TableHead className="font-semibold">Location</TableHead>
              <TableHead className="text-center font-semibold">System Qty</TableHead>
              <TableHead className="text-center font-semibold">Physical Qty</TableHead>
              <TableHead className="text-center font-semibold">Variance</TableHead>
              <TableHead className="text-center font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Last Audited</TableHead>

            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length > 0 ? (
              filteredData.map((item, index) => (
                <TableRow
                  key={`${item.id}-${item.location}-${index}`}
                  className={getRowClassName(item.status, item.systemQuantity, item.physicalQuantity)}
                >
                  <TableCell className="font-medium">{item.sku}</TableCell>
                  <TableCell className="max-w-xs truncate" title={item.name}>
                    {item.name}
                  </TableCell>
                  <TableCell>
                    {/* ✅ FIX: Display a dash if category is empty */}
                    <Badge variant="outline">{item.category || '-'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {/* ✅ FIX: Display a dash if location is empty */}
                      {item.location ? (
                        <>
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          {item.location}
                        </>
                      ) : (
                        '-'
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">{item.systemQuantity}</TableCell>
                  <TableCell className={`text-center font-medium ${getQuantityCellClass(item.status, item.systemQuantity, item.physicalQuantity)}`}>
                    {item.physicalQuantity}
                    {item.status === "discrepancy" && (
                      <div className="text-xs text-gray-500 mt-1">

                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.physicalQuantity - item.systemQuantity  }
                  </TableCell>
                  <TableCell>
                    {renderStatus(item.status, item.systemQuantity, item.physicalQuantity)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(item.lastAudited)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Clock className="h-8 w-8 text-gray-400" />
                    <span>No inventory data available for the selected location.</span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium mb-2">Status Legend:</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span><strong>Matched:</strong> Physical quantity equals system quantity</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span><strong>Discrepancy:</strong> Physical quantity differs from system quantity</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <span><strong>Pending:</strong> Item not yet scanned/audited</span>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-orange-600" />
              <span>Over count (more physical than system)</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-600" />
              <span>Under count (less physical than system)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};