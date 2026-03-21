import { useInventory } from "@/context/InventoryContext";
import { useLocationFilter } from "@/hooks/useLocationFilter";
import { useCompany } from "@/context/CompanyContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Clock,
  Search,
  MessageSquare,
  ShieldAlert
} from "lucide-react";
import { format } from "date-fns";
import { useUser } from "@/context/UserContext";
import { useUserAccess } from "@/hooks/useUserAccess";
import { useMemo, useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ROW_LIMIT = 100;

export const InventoryTable = () => {
  const { itemMaster, auditedItems, locations, updateItemRemark, assignments } = useInventory();
  const { currentUser } = useUser();
  const { accessibleLocations } = useUserAccess();
  const { selectedLocation } = useLocationFilter();
  const { selectedAssignmentId } = useCompany();

  const [searchQuery, setSearchQuery] = useState("");
  const [editingRemark, setEditingRemark] = useState<string | null>(null);
  const [tempRemark, setTempRemark] = useState("");

  // 🔥 CHECK BLIND AUDIT STATUS
  const currentAssignment = assignments.find(a => String(a.id) === String(selectedAssignmentId));
  const isAuditor = currentUser?.role === 'auditor';
  const hideSystemQuantity = isAuditor && currentAssignment?.showSystemQuantity === false;

  const userLocations = useMemo(() => accessibleLocations(), [accessibleLocations]);
  const currentLocationObj = useMemo(() => locations.find(loc => loc.id === selectedLocation), [locations, selectedLocation]);

  const canEditRemarks = useMemo(() => {
    if (!currentLocationObj) return false;
    return currentUser?.role === 'client' && currentLocationObj.auditStatus === 'submitted';
  }, [currentUser, currentLocationObj]);

  const allTableData = useMemo(() => {
    return itemMaster
      .filter((item) => item.location !== "")
      .map((item) => {
        const auditedItem = auditedItems.find((a) => a.id === item.id && a.location === item.location);
        if (auditedItem) {
          return {
            ...item,
            physicalQuantity: auditedItem.physicalQuantity,
            status: auditedItem.status,
            lastAudited: auditedItem.lastAudited,
            clientRemarks: item.clientRemarks, 
            customAttributes: item.customAttributes || {}
          };
        }
        return {
          ...item,
          physicalQuantity: 0,
          status: "pending" as const,
          lastAudited: undefined,
          auditedBy: undefined,
          clientRemarks: item.clientRemarks,
          customAttributes: item.customAttributes || {}
        };
      });
  }, [itemMaster, auditedItems]);

  const locationFilteredData = useMemo(() => {
    const isAllLocations = !selectedLocation || selectedLocation === "all";

    if (isAllLocations) {
      if (currentUser?.role === "admin" || currentUser?.role === "super_admin") {
        return allTableData;
      } 
      else {
        const accessibleLocationNames = userLocations.map((loc) => loc.name);
        return allTableData.filter((item) => accessibleLocationNames.includes(item.location));
      }
    } 
    
    if (currentLocationObj) return allTableData.filter((item) => item.location === currentLocationObj.name);
    return [];
  }, [allTableData, selectedLocation, currentLocationObj, currentUser?.role, userLocations]);

  const rawDynamicColumns = useMemo(() => {
    const keys = new Set<string>();
    locationFilteredData.forEach(item => {
      if (item.customAttributes) Object.keys(item.customAttributes).forEach(k => keys.add(k));
    });
    return Array.from(keys).sort();
  }, [locationFilteredData]);

  const priceColumnKey = useMemo(() => {
    const priceKeywords = ['unit price', 'unit_price', 'price', 'rate', 'cost', 'mrp', 'unit cost'];
    return rawDynamicColumns.find(col => priceKeywords.includes(col.toLowerCase()));
  }, [rawDynamicColumns]);

  const displayDynamicColumns = useMemo(() => {
    const excluded = [priceColumnKey, 'system_value', 'physical_value'].filter(Boolean);
    return rawDynamicColumns.filter(col => !excluded.includes(col));
  }, [rawDynamicColumns, priceColumnKey]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return locationFilteredData;
    const query = searchQuery.toLowerCase();
    return locationFilteredData.filter(
      (item) =>
        item.sku.toLowerCase().includes(query) ||
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.category && item.category.toLowerCase().includes(query)) ||
        displayDynamicColumns.some(col => String(item.customAttributes?.[col] || "").toLowerCase().includes(query))
    );
  }, [locationFilteredData, searchQuery, displayDynamicColumns]);

  const [visibleCount, setVisibleCount] = useState(ROW_LIMIT);
  useEffect(() => { setVisibleCount(ROW_LIMIT); }, [selectedLocation, currentUser?.role, locationFilteredData.length, searchQuery]);

  const visibleData = useMemo(() => filteredData.slice(0, visibleCount), [filteredData, visibleCount]);
  const hasMoreToShow = filteredData.length > visibleData.length;

  const handleShowMore = () => setVisibleCount((prev) => Math.min(prev + ROW_LIMIT, filteredData.length));
  const handleShowAll = () => setVisibleCount(filteredData.length);
  const handleRemarkStart = (id: string, currentVal: string) => { setEditingRemark(id); setTempRemark(currentVal || ""); };
  const handleRemarkSave = async (id: string) => { if (tempRemark.trim()) await updateItemRemark(id, tempRemark); setEditingRemark(null); };

  const parsePrice = (val: any): number => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const renderStatus = useCallback(
    (status: string | undefined, physicalQty: number) => {
      if (hideSystemQuantity) {
          if (physicalQty > 0 || status !== 'pending') {
              return (
                <div className="flex items-center justify-center">
                  <ShieldAlert className="h-4 w-4 text-blue-500 mr-1" />
                  <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200 shadow-none">Audited</Badge>
                </div>
              );
          }
          return (
            <div className="flex items-center justify-center">
              <Clock className="h-4 w-4 text-gray-400 mr-1" />
              <Badge variant="outline" className="text-gray-600">Pending</Badge>
            </div>
          );
      }

      switch (status) {
        case "matched":
          return (<div className="flex items-center justify-center"><CheckCircle className="h-4 w-4 text-green-500 mr-1" /><Badge variant="default" className="bg-green-100 text-green-800 border-green-200 shadow-none">Matched</Badge></div>);
        case "discrepancy":
          return (<div className="flex items-center justify-center gap-2"><Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200 shadow-none">Discrepancy</Badge></div>);
        default:
          return (<div className="flex items-center justify-center"><Clock className="h-4 w-4 text-gray-400 mr-1" /><Badge variant="outline" className="text-gray-600">Pending</Badge></div>);
      }
    }, [hideSystemQuantity]
  );

  const formatDate = useCallback((dateString: string | undefined) => {
    if (!dateString) return "-";
    try { return format(new Date(dateString), "dd MMM yyyy HH:mm"); } catch { return "-"; }
  }, []);

  const getRowClassName = useCallback(
    (status: string | undefined, systemQty: number, physicalQty: number) => {
      if (hideSystemQuantity) return (physicalQty > 0 || status !== 'pending') ? "bg-blue-50/30 hover:bg-blue-50" : "hover:bg-gray-50";

      switch (status) {
        case "discrepancy": return physicalQty > systemQty ? "bg-orange-50 hover:bg-orange-100" : "bg-red-50 hover:bg-red-100";
        case "matched": return "bg-green-50 hover:bg-green-100";
        default: return "hover:bg-gray-50";
      }
    }, [hideSystemQuantity]
  );

  const getQuantityCellClass = useCallback(
    (status: string | undefined, systemQty: number, physicalQty: number) => {
      if (hideSystemQuantity) return physicalQty > 0 ? "text-blue-600 font-semibold" : "";
      if (status === "discrepancy") return physicalQty > systemQty ? "text-orange-600 font-semibold" : "text-red-600 font-semibold";
      if (status === "matched") return "text-green-600 font-semibold";
      return "";
    }, [hideSystemQuantity]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="text" placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="rounded-md border bg-white overflow-x-auto"> 
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="font-semibold w-[120px]">SKU</TableHead>
              <TableHead className="font-semibold min-w-[200px]">Name</TableHead>
              <TableHead className="font-semibold">Category</TableHead>
              
              {displayDynamicColumns.map(colKey => (<TableHead key={colKey} className="font-semibold capitalize min-w-[100px]">{colKey.replace(/_/g, ' ')}</TableHead>))}

              {priceColumnKey && !hideSystemQuantity && (
                <>
                  <TableHead className="text-right font-semibold w-[100px] bg-indigo-50/50">Unit Price</TableHead>
                  <TableHead className="text-right font-semibold w-[100px] bg-indigo-50/50">Sys Value</TableHead>
                  <TableHead className="text-right font-semibold w-[100px] bg-indigo-50/50">Phy Value</TableHead>
                  <TableHead className="text-right font-semibold w-[100px] bg-indigo-50/50">Val Var</TableHead> 
                </>
              )}

              <TableHead className="font-semibold">Location</TableHead>
              
              {/* 🔥 HIDE SYSTEM QUANTITY & VAR COLUMNS ENTIRELY */}
              {!hideSystemQuantity && <TableHead className="text-center font-semibold w-[80px]">Sys Qty</TableHead>}
              
              <TableHead className="text-center font-semibold w-[80px]">Phy Qty</TableHead>
              
              {!hideSystemQuantity && <TableHead className="text-center font-semibold w-[80px]">Var</TableHead>}
              
              <TableHead className="text-center font-semibold w-[120px]">Status</TableHead>
              <TableHead className="font-semibold w-[150px]">Last Audited</TableHead>
              <TableHead className="font-semibold w-[200px]">Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length > 0 ? (
              visibleData.map((item, index) => {
                const physicalQty = item.physicalQuantity ?? 0;
                let unitPrice = 0, sysValue = 0, phyValue = 0, valueVariance = 0;

                if (priceColumnKey && !hideSystemQuantity) {
                   unitPrice = parsePrice(item.customAttributes?.['unit_price'] || item.customAttributes?.[priceColumnKey]);
                   sysValue = item.customAttributes?.['system_value'] ? parsePrice(item.customAttributes['system_value']) : unitPrice * item.systemQuantity;
                   phyValue = item.customAttributes?.['physical_value'] ? parsePrice(item.customAttributes['physical_value']) : unitPrice * physicalQty;
                   valueVariance = phyValue - sysValue;
                }

                return (
                  <TableRow key={`${item.id}-${item.location}-${index}`} className={getRowClassName(item.status, item.systemQuantity, physicalQty)}>
                    <TableCell className="font-medium text-xs">{item.sku}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm" title={item.name}>{item.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{item.category || "-"}</Badge></TableCell>

                    {displayDynamicColumns.map(colKey => (<TableCell key={colKey} className="text-xs text-gray-600">{item.customAttributes?.[colKey] !== undefined ? String(item.customAttributes[colKey]) : "-"}</TableCell>))}

                    {priceColumnKey && !hideSystemQuantity && (
                        <>
                          <TableCell className="text-right text-xs font-mono bg-indigo-50/30">{formatCurrency(unitPrice)}</TableCell>
                          <TableCell className="text-right text-xs font-mono bg-indigo-50/30 font-medium text-gray-700">{formatCurrency(sysValue)}</TableCell>
                          <TableCell className={`text-right text-xs font-mono bg-indigo-50/30 font-medium ${item.status === 'discrepancy' ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(phyValue)}</TableCell>
                          <TableCell className={`text-right text-xs font-mono bg-indigo-50/30 font-bold ${valueVariance < 0 ? 'text-red-600' : valueVariance > 0 ? 'text-green-600' : 'text-gray-500'}`}>{formatCurrency(valueVariance)}</TableCell>
                        </>
                    )}

                    <TableCell className="text-xs">{item.location}</TableCell>
                    
                    {/* 🔥 HIDE SYSTEM QUANTITY & VAR CELLS ENTIRELY */}
                    {!hideSystemQuantity && (
                        <TableCell className="text-center font-medium text-sm">
                          {item.systemQuantity}
                        </TableCell>
                    )}
                    
                    <TableCell className={`text-center font-medium text-sm ${getQuantityCellClass(item.status, item.systemQuantity, physicalQty)}`}>
                      {physicalQty}
                    </TableCell>
                    
                    {!hideSystemQuantity && (
                        <TableCell className="text-center text-sm">{physicalQty - item.systemQuantity}</TableCell>
                    )}
                    
                    <TableCell className="text-center">{renderStatus(item.status, physicalQty)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(item.lastAudited)}</TableCell>
                    
                    <TableCell>
                      {editingRemark === item.id ? (
                        <div className="flex gap-1">
                          <Input value={tempRemark} onChange={(e) => setTempRemark(e.target.value)} className="h-7 text-xs" placeholder="Reason..." autoFocus onBlur={() => handleRemarkSave(item.id)} onKeyDown={(e) => e.key === 'Enter' && handleRemarkSave(item.id)} />
                        </div>
                      ) : (
                        <div className={`text-xs flex items-center gap-2 min-h-[20px] ${canEditRemarks && item.status === 'discrepancy' ? "cursor-pointer hover:bg-black/5 rounded px-1 -ml-1" : ""}`} onClick={() => canEditRemarks && item.status === 'discrepancy' ? handleRemarkStart(item.id, item.clientRemarks || "") : undefined}>
                          {item.clientRemarks ? <span className="text-gray-700">{item.clientRemarks}</span> : canEditRemarks && item.status === 'discrepancy' ? <span className="text-muted-foreground italic flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Add remark</span> : <span className="text-muted-foreground">-</span>}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                {/* Dynamically calculate colspan based on visible columns */}
                <TableCell colSpan={hideSystemQuantity ? 9 + displayDynamicColumns.length : 11 + displayDynamicColumns.length + (priceColumnKey ? 4 : 0)} className="text-center py-8 text-muted-foreground">No data found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {filteredData.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground">
            <span>Showing {visibleData.length} of {filteredData.length} items</span>
            {hasMoreToShow && (
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={handleShowMore} className="h-8 px-2">Show next {ROW_LIMIT}</Button>
                <Button variant="ghost" size="sm" onClick={handleShowAll} className="h-8 px-2">Show all</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};