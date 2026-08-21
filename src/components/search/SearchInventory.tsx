import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useInventory, InventoryItem } from "@/context/InventoryContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Minus, MapPin, AlertCircle, PackagePlus, ScanBarcode, ArrowLeft, Check, ChevronsUpDown, MessageSquare, ShieldAlert, Loader2, Trash2, Hash, Tag, Layers } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/context/UserContext";
import { useCompany } from "@/context/CompanyContext";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { SyncStatusBanner } from "@/components/scanner/SyncStatusBanner";
import SupabaseDataService from "@/services/SupabaseDataService";

const SearchItemRow = React.memo(({ 
    item, itemKey, isAdmin, isDecimalMode, hideSystemQuantity, 
    decimalQuantity, onDecimalChange, selectedUnit, onUnitChange, 
    quantity, onIncrement, onDecrement, remark, onRemarkChange, 
    onRemarkBlur, onAdd, onDeduct, selectedSubLocation, isSelected, onToggleSelect
}: any) => {
    
    const auditorEntries = item.auditorEntries || [];
    const calculatedTotal = Number(auditorEntries.reduce((sum: number, entry: any) => sum + (entry.quantityFound || 0), 0).toFixed(4));

    const consolidatedMap = new Map();
    auditorEntries.forEach((entry: any) => {
        const mappedName = entry.auditorName || 'Unknown';
        const key = `${mappedName}-${entry.subLocation || 'General'}`;
        if (!consolidatedMap.has(key)) {
            consolidatedMap.set(key, { name: mappedName, subLocation: entry.subLocation, quantityFound: Number(entry.quantityFound) || 0 });
        } else {
            consolidatedMap.get(key).quantityFound += (Number(entry.quantityFound) || 0);
        }
    });
    const consolidatedEntries = Array.from(consolidatedMap.values());

    const itemUploadedUnit = item.customAttributes?.['Unit'];
    const currentSelectedUnit = selectedUnit !== undefined ? selectedUnit : (itemUploadedUnit || "none");

    return (
        <div className={cn(
            "group relative flex flex-col md:flex-row gap-6 p-6 mb-4 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 bg-white",
            isSelected ? "border-blue-400 ring-1 ring-blue-400/20 bg-blue-50/10" : "border-slate-200"
        )}>
            
            {/* Checkbox (Admin) */}
            {isAdmin && (
                <div className="absolute top-6 left-6 z-10">
                    <Checkbox 
                        checked={isSelected} 
                        onCheckedChange={() => onToggleSelect(item.id)} 
                        className="h-5 w-5 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 rounded"
                    />
                </div>
            )}
            
            {/* Left Content: Details */}
            <div className={cn("flex-1 min-w-0 space-y-4", isAdmin && "pl-8")}>
                
                {/* Title & Badges */}
                <div>
                    <h3 className="text-[18px] font-black text-slate-900 tracking-tight leading-snug truncate">
                        {item.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                            <Hash className="h-3 w-3 opacity-70" /> {item.sku}
                        </span>
                        {item.category && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                                <Tag className="h-3 w-3 opacity-70" /> {item.category}
                            </span>
                        )}
                        {!hideSystemQuantity ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-[11px] font-black text-blue-700 uppercase tracking-widest shadow-sm">
                                <Layers className="h-3 w-3 opacity-70" /> Sys Qty: {item.systemQuantity} {itemUploadedUnit}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-[11px] font-black text-rose-700 uppercase tracking-widest shadow-sm">
                                <ShieldAlert className="h-3 w-3" /> Hidden Qty
                            </span>
                        )}
                    </div>
                </div>
                
                {/* Auditor Breakdown */}
                {consolidatedEntries.length > 0 && (
                <div className="bg-slate-50/80 rounded-xl border border-slate-100 p-4 w-full md:max-w-sm">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 border-b border-slate-200 pb-2">Auditor Breakdown</h4>
                    <div className="space-y-2">
                      {consolidatedEntries.map((entry: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-[13px] font-medium text-slate-700">
                          <span className="truncate pr-4 flex items-center gap-2">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                              {entry.name} 
                              {entry.subLocation && <span className="text-slate-400 text-[11px] bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-sm">{entry.subLocation}</span>}
                          </span>
                          <span className="font-black text-blue-600">{entry.quantityFound}</span>
                      </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600">Total Found</span>
                      <span className="text-[16px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">{calculatedTotal}</span>
                    </div>
                </div>
                )}
            </div>
            
            {/* Right Content: Controls */}
            <div className="w-full md:w-[300px] shrink-0 bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-4">
                
                {/* Stepper / Input */}
                {isDecimalMode ? (
                    <div className="flex items-center gap-2 w-full">
                        <Input 
                            type="number" step="any" placeholder="Qty" 
                            value={decimalQuantity || ""} onChange={(e) => onDecimalChange(e.target.value)}
                            className="h-11 rounded-lg border-slate-200 font-bold text-[15px] focus-visible:ring-blue-500 shadow-sm bg-white"
                        />
                        <Select value={currentSelectedUnit} onValueChange={onUnitChange}>
                            <SelectTrigger className="w-[100px] h-11 bg-white border-slate-200 rounded-lg shadow-sm font-bold text-[13px]">
                                <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-slate-200">
                                <SelectItem value="none">No Unit</SelectItem>
                                {itemUploadedUnit && <SelectItem value={itemUploadedUnit}>{itemUploadedUnit}</SelectItem>}
                            </SelectContent>
                        </Select>
                    </div>
                ) : (
                    <div className="flex items-center justify-between w-full bg-white rounded-xl border border-slate-200 p-1.5 shadow-sm">
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 active:scale-95 transition-all" onClick={onDecrement}>
                          <Minus className="h-5 w-5" />
                      </Button>
                      <span className="w-16 text-center font-black text-[18px] text-slate-900 select-none">
                          {quantity || 0}
                      </span>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg hover:bg-blue-50 text-blue-600 hover:text-blue-700 active:scale-95 transition-all" onClick={onIncrement}>
                          <Plus className="h-5 w-5" />
                      </Button>
                    </div>
                )}

                {/* Remark Input */}
                <div className="w-full relative group/input">
                  <MessageSquare className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 group-focus-within/input:text-blue-500 transition-colors" />
                  <Input
                      placeholder="Add a remark (optional)..."
                      value={remark !== undefined ? remark : (item.clientRemarks || "")}
                      onChange={(e) => onRemarkChange(e.target.value)}
                      onBlur={onRemarkBlur}
                      className="h-11 w-full pl-10 text-[13px] font-medium rounded-lg border-slate-200 bg-white focus-visible:ring-blue-500 shadow-sm transition-all"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 w-full pt-1">
                {isAdmin && (
                    <Button 
                        variant="outline"
                        className="h-11 flex-1 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 font-bold text-[13px] shadow-sm transition-all active:scale-[0.98]"
                        onClick={onDeduct}
                        disabled={isDecimalMode ? !(parseFloat(decimalQuantity) > 0) || !selectedSubLocation : !(quantity > 0) || !selectedSubLocation}
                    >
                        <Minus className="h-4 w-4 mr-1.5" /> Deduct
                    </Button>
                )}
                <Button 
                    className="h-11 flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[13px] shadow-sm transition-all active:scale-[0.98]"
                    onClick={onAdd}
                    disabled={isDecimalMode ? !(parseFloat(decimalQuantity) > 0) || !selectedSubLocation : !(quantity > 0) || !selectedSubLocation}
                >
                    <Check className="h-4 w-4 mr-1.5" /> Add Count
                </Button>
                </div>
            </div>
        </div>
    );
});

export const SearchInventory = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  
  const [isDecimalMode, setIsDecimalMode] = useState(false);
  const [decimalQuantities, setDecimalQuantities] = useState<Record<string, string>>({});
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>({});

  const [newSubLocation, setNewSubLocation] = useState("");
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>("");
  const [subLocationSearchOpen, setSubLocationSearchOpen] = useState(false);
  const [subLocationSearchQuery, setSubLocationSearchQuery] = useState("");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isScanningNewItem, setIsScanningNewItem] = useState(false);
  
  const [searchLoading, setSearchLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const SEARCH_LIMIT = 50;
  
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const [newItem, setNewItem] = useState({ sku: "", name: "", physicalQuantity: 1 as number | string });
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [customCategory, setCustomCategory] = useState<string>("");
  const [newCustomAttributes, setNewCustomAttributes] = useState<Record<string, any>>({});
  
  const [globalCategories, setGlobalCategories] = useState<string[]>([]);
  const [globalCustomFields, setGlobalCustomFields] = useState<string[]>([]);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lastAutoFilledSku, setLastAutoFilledSku] = useState("");

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const { 
    itemMaster, addItemToAudit, addSurplusItem, deleteItems, assignments, 
    locations, activeSubLocations, fetchSubLocations, addSubLocationToDb,
    updateItemRemark, fetchGlobalItem
  } = useInventory();

  const { currentUser, user } = useUser();
  const { selectedCompanyId, selectedAssignmentId } = useCompany();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const currentAssignment = assignments.find(a => String(a.id) === String(selectedAssignmentId));
  const activeLocationId = currentAssignment?.locationId;
  const activeLocationName = locations.find(l => String(l.id) === String(activeLocationId))?.name;
  const hideSystemQuantity = currentUser?.role === 'auditor' && currentAssignment?.showSystemQuantity === false;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    if (activeLocationId && isOnline) fetchSubLocations(activeLocationId, subLocationSearchQuery).catch(console.error);
  }, [activeLocationId, subLocationSearchQuery, fetchSubLocations, isOnline]); 

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedQuery(searchQuery); setOffset(0); }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let isMounted = true;
    const fetchGlobalFields = async () => {
        if (!selectedCompanyId || !isOnline) return;
        try {
            const { data } = await supabase.from('inventory_items').select('category, custom_attributes').eq('company_id', selectedCompanyId);
            if (data && isMounted) {
                const cats = new Set<string>();
                const attrs = new Set<string>();
                const excludedKeys = ['unit price', 'unit_price', 'price', 'rate', 'cost', 'mrp', 'unit cost', 'system_value', 'physical_value'];
                data.forEach(item => {
                    if (item.category) cats.add(item.category.trim());
                    if (item.custom_attributes) {
                        Object.keys(item.custom_attributes).forEach(k => {
                            if (!excludedKeys.includes(k.toLowerCase().trim())) attrs.add(k.trim());
                        });
                    }
                });
                setGlobalCategories(Array.from(cats));
                setGlobalCustomFields(Array.from(attrs));
            }
        } catch (e) { console.error("Failed to fetch global fields", e); }
    };
    fetchGlobalFields();
    return () => { isMounted = false; };
  }, [selectedCompanyId, isOnline]);

  useEffect(() => {
    const lookupSku = async () => {
        const currentSku = newItem.sku.trim();
        if (currentSku && currentSku.length >= 2 && isOnline && currentSku !== lastAutoFilledSku) {
            setIsLookingUp(true);
            try {
                const globalItem = await fetchGlobalItem(currentSku);
                if (globalItem) {
                    setNewItem(prev => ({ ...prev, name: prev.name || globalItem.name || "" }));
                    if (globalItem.category && !selectedCategory) setSelectedCategory(globalItem.category);
                    if (globalItem.customAttributes || globalItem.custom_attributes) {
                        const attrs = globalItem.customAttributes || globalItem.custom_attributes || {};
                        setNewCustomAttributes(prev => ({...attrs, ...prev}));
                    }
                    setLastAutoFilledSku(currentSku);
                    toast.success("Auto-filled details from Master Database!");
                }
            } catch(e) {
            } finally { setIsLookingUp(false); }
        }
    };
    const timer = setTimeout(lookupSku, 800);
    return () => clearTimeout(timer);
  }, [newItem.sku, isOnline, lastAutoFilledSku, fetchGlobalItem, selectedCategory]);

  useEffect(() => {
    let cancelled = false;
    const runSearch = async () => {
      if (!debouncedQuery || debouncedQuery.length < 2 || !selectedCompanyId) {
        setSearchResults([]); setHasMore(false); return;
      }
      setSearchLoading(true);
      try {
        const { items, hasMore: more } = await SupabaseDataService.searchInventoryItems({
          companyId: selectedCompanyId, assignmentId: selectedAssignmentId,
          query: debouncedQuery, locationId: activeLocationId || null,
          limit: SEARCH_LIMIT, offset,
        });
        if (!cancelled) {
          if (offset === 0) setSearchResults(items);
          else setSearchResults(prev => [...prev, ...items]);
          setHasMore(more);
        }
      } catch (e) { console.error("Search failed:", e); } 
      finally { if (!cancelled) setSearchLoading(false); }
    };
    runSearch();
    return () => { cancelled = true; };
  }, [debouncedQuery, selectedCompanyId, selectedAssignmentId, activeLocationId, offset]);

  const dynamicFormFields = useMemo(() => {
    const categoriesMap = new Map<string, string>();
    const attributesMap = new Map<string, string>();
    const excludedKeys = ['unit price', 'unit_price', 'price', 'rate', 'cost', 'mrp', 'unit cost', 'system_value', 'physical_value'];
    globalCategories.forEach(c => { if (c) categoriesMap.set(c.trim().toLowerCase(), c.trim()); });
    globalCustomFields.forEach(f => { if (f) attributesMap.set(f.trim().toLowerCase(), f.trim()); });
    itemMaster.forEach(item => {
        if (item.category) {
            const cat = item.category.trim();
            if (!categoriesMap.has(cat.toLowerCase())) categoriesMap.set(cat.toLowerCase(), cat);
        }
        if (item.customAttributes) {
            Object.keys(item.customAttributes).forEach(key => {
                const cleanKey = key.trim();
                if (!excludedKeys.includes(cleanKey.toLowerCase())) {
                    if (!attributesMap.has(cleanKey.toLowerCase())) attributesMap.set(cleanKey.toLowerCase(), cleanKey);
                }
            });
        }
    });
    if (!attributesMap.has('unit_price')) attributesMap.set('unit_price', 'unit_price');
    return { categories: Array.from(categoriesMap.values()).sort(), customFields: Array.from(attributesMap.values()).sort() };
  }, [itemMaster, globalCategories, globalCustomFields]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setDebouncedQuery(searchQuery); };
  const getItemKey = useCallback((item: InventoryItem) => `${item.id}-${item.location}`, []);

  const handleAddSubLocation = async () => {
        if (!isOnline) { toast.error("Offline", { description: "Cannot create new sub-locations while offline." }); return; }
        if (!newSubLocation.trim()) return;
        if (!activeLocationId) { toast.error("No active location found"); return; }
        try {
            await addSubLocationToDb(newSubLocation.trim(), activeLocationId);
            setSelectedSubLocation(newSubLocation.trim());
            setNewSubLocation("");
            toast.success(`Sub-location saved: ${newSubLocation.trim()}`);
        } catch (error) { toast.error("Failed to save sub-location"); }
  };

  const handleRemarkBlur = useCallback(async (item: InventoryItem) => {
    const itemKey = getItemKey(item);
    const currentRemark = remarks[itemKey];
    if (currentRemark !== undefined && currentRemark !== (item.clientRemarks || "")) {
        try { await updateItemRemark(item.id, currentRemark); toast.success("Remark updated"); } 
        catch (e) { toast.error("Failed to save remark"); }
    }
  }, [getItemKey, remarks, updateItemRemark]);

  const handleAddToAudit = useCallback(async (item: InventoryItem, isDeduction: boolean = false) => {
    if (!selectedSubLocation) { toast.error("Sub-Location Required", { description: "Please select a Box, Row, or Rack before adding." }); return; }
    const itemKey = getItemKey(item);
    let inputQuantity = 0, unitText = "";

    if (isDecimalMode) {
        inputQuantity = parseFloat(decimalQuantities[itemKey]) || 0;
        const itemUploadedUnit = item.customAttributes?.['Unit'];
        const finalUnit = selectedUnits[itemKey] !== undefined ? selectedUnits[itemKey] : (itemUploadedUnit || "none");
        if (finalUnit !== "none") unitText = ` ${finalUnit}`;
    } else {
        inputQuantity = quantities[itemKey] || 0;
    }

    if (inputQuantity <= 0) { toast.error("Invalid Quantity", { description: "Input must be greater than 0." }); return; }
    const quantityToApply = isDeduction ? -Math.abs(inputQuantity) : Math.abs(inputQuantity);

    try {
      const activeName = currentUser?.email || currentUser?.name || user?.email || "Unknown Auditor";
      await addItemToAudit(item, quantityToApply, currentUser?.id || user?.id, activeName, selectedSubLocation);
      const currentRemark = remarks[itemKey] !== undefined ? remarks[itemKey] : (item.clientRemarks || "");
      if (currentRemark !== (item.clientRemarks || "")) await updateItemRemark(item.id, currentRemark);

      toast.success(isDeduction ? "Quantity Deducted" : "Item added to audit", { description: `${isDeduction ? 'Removed' : 'Added'} ${Math.abs(quantityToApply)}${unitText} for ${item.name} at ${selectedSubLocation}` });

      if (isDecimalMode) setDecimalQuantities(prev => ({ ...prev, [itemKey]: "" }));
      else setQuantities(prev => ({ ...prev, [itemKey]: 0 }));
    } catch (error: any) {
      toast.error(isDeduction ? "Failed to deduct item" : "Failed to add item", { description: error.message || "An error occurred" });
    }
  }, [selectedSubLocation, getItemKey, isDecimalMode, decimalQuantities, selectedUnits, quantities, currentUser, user, addItemToAudit, remarks, updateItemRemark]);

  const handleAddSurplus = async () => {
    if (!newItem.sku || !newItem.name) { toast.error("SKU and Name are required"); return; }
    const finalCategory = selectedCategory === "other" ? customCategory : selectedCategory;
    if (!finalCategory) { toast.error("Please select or enter a category"); return; }

    try {
      const submissionItem = { ...newItem, category: finalCategory, physicalQuantity: Number(newItem.physicalQuantity) || 0, subLocation: selectedSubLocation, customAttributes: newCustomAttributes };
      await addSurplusItem(submissionItem);
      toast.success("Surplus item added successfully");
      setIsAddOpen(false); setSearchQuery(newItem.sku); 
      setNewItem({ sku: "", name: "", physicalQuantity: 1 }); setSelectedCategory(""); setCustomCategory(""); setNewCustomAttributes({});
    } catch (error: any) { toast.error("Failed to add surplus item", { description: error.message }); }
  };

  const handleToggleSelect = useCallback((id: string) => {
      setSelectedItemIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
      });
  }, []);

  const handleSelectAllVisible = useCallback((checked: boolean) => {
      const visibleIds = searchResults.map(item => item.id);
      setSelectedItemIds(prev => {
          const next = new Set(prev);
          if (checked) visibleIds.forEach(id => next.add(id));
          else visibleIds.forEach(id => next.delete(id));
          return next;
      });
  }, [searchResults]);

  const handleBulkDelete = async () => {
      if (!window.confirm(`Are you sure you want to permanently delete ${selectedItemIds.size} item(s)? This action cannot be undone.`)) return;
      try {
          await deleteItems(Array.from(selectedItemIds));
          setSelectedItemIds(new Set()); 
      } catch (error: any) { toast.error("Failed to delete items", { description: error.message }); }
  };

  const hasNoResults = debouncedQuery.length >= 2 && searchResults.length === 0 && !searchLoading;
  const visibleItems = searchResults;

  return (
    <div className="flex flex-col gap-8 relative">
      
      <SyncStatusBanner />

      {/* ── Settings & Sub-Location Zone ── */}
      {activeLocationName && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-[14px] font-medium text-slate-600 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    Searching inside: <strong className="text-slate-900 font-black">{activeLocationName}</strong>
                </div>
                
                <div className="flex items-center gap-3">
                    <Label htmlFor="decimal-mode-search" className="text-[12px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer select-none">
                        Enable Decimals & Units
                    </Label>
                    <Checkbox 
                        id="decimal-mode-search" 
                        checked={isDecimalMode} 
                        onCheckedChange={(c) => setIsDecimalMode(!!c)}
                        className="h-5 w-5 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 rounded"
                    />
                </div>
            </div>

            <div className="p-5 bg-blue-50/50 rounded-xl border border-blue-100">
                <Label className="text-[12px] font-black text-blue-800 uppercase tracking-widest mb-3 block">
                    Audit Sub-Location (Box / Row / Rack) <span className="text-rose-500">*</span>
                </Label>
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex gap-2 flex-1">
                        <Input 
                            placeholder="Type new sub-location..." 
                            value={newSubLocation}
                            onChange={(e) => setNewSubLocation(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSubLocation()}
                            className="bg-white h-12 rounded-xl border-blue-200 focus-visible:ring-blue-500 shadow-sm font-medium"
                            disabled={!isOnline}
                        />
                        <Button onClick={handleAddSubLocation} className="h-12 w-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all active:scale-95 shrink-0" disabled={!isOnline}>
                            <Plus className="h-5 w-5" />
                        </Button>
                    </div>
                    
                    <Popover open={subLocationSearchOpen} onOpenChange={setSubLocationSearchOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={subLocationSearchOpen}
                                className="w-full sm:w-[280px] h-12 justify-between bg-white border-blue-200 text-slate-700 font-bold rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
                            >
                                {selectedSubLocation ? selectedSubLocation : "Select existing..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0 rounded-xl border-slate-200 shadow-xl" align="end">
                            <Command shouldFilter={false} className="rounded-xl">
                                <CommandInput 
                                    placeholder="Search sub-location..." 
                                    value={subLocationSearchQuery}
                                    onValueChange={setSubLocationSearchQuery}
                                />
                                <CommandList>
                                    <CommandEmpty className="py-4 text-center text-[13px] font-medium text-slate-500">No sub-location found.</CommandEmpty>
                                    <CommandGroup>
                                        {activeSubLocations.map((sl) => (
                                            <CommandItem
                                                key={sl}
                                                value={sl}
                                                className="font-bold text-[13px] py-2.5 cursor-pointer"
                                                onSelect={(currentValue) => {
                                                    setSelectedSubLocation(currentValue);
                                                    setSubLocationSearchOpen(false);
                                                }}
                                            >
                                                <Check className={cn("mr-3 h-4 w-4 text-blue-600", selectedSubLocation === sl ? "opacity-100" : "opacity-0")} />
                                                {sl}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>
      )}

      {/* ── Main Search Bar ── */}
      <div className="relative group z-10">
        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
          <Search className="h-6 w-6 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
        </div>
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Name, SKU, or Category..."
          className="h-16 w-full pl-14 pr-6 rounded-[24px] bg-white border border-slate-200 text-[16px] font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium focus-visible:ring-4 focus-visible:ring-blue-500/10 focus-visible:border-blue-500 transition-all shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)]"
        />
        {searchLoading && (
            <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            </div>
        )}
      </div>

      {/* ── Results Area ── */}
      <div className="space-y-4">
        {searchResults.length > 0 ? (
          <div>
            {/* Admin Select All Row */}
            {isAdmin && (
                <div className="flex items-center gap-3 mb-4 px-2">
                    <Checkbox 
                        checked={visibleItems.length > 0 && visibleItems.every(i => selectedItemIds.has(i.id))}
                        onCheckedChange={handleSelectAllVisible}
                        id="selectAllVisible"
                        className="h-5 w-5 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 rounded"
                    />
                    <Label htmlFor="selectAllVisible" className="text-[12px] font-bold uppercase tracking-widest text-slate-500 cursor-pointer">
                        Select All Visible Items
                    </Label>
                </div>
            )}
            
            <div className="flex flex-col">
              {visibleItems.map((item) => {
                const itemKey = getItemKey(item);
                return (
                    <SearchItemRow 
                        key={itemKey} item={item} itemKey={itemKey} isAdmin={isAdmin}
                        isSelected={selectedItemIds.has(item.id)} onToggleSelect={handleToggleSelect}
                        isDecimalMode={isDecimalMode} hideSystemQuantity={hideSystemQuantity}
                        decimalQuantity={decimalQuantities[itemKey]}
                        onDecimalChange={(val: any) => setDecimalQuantities(prev => ({ ...prev, [itemKey]: val }))}
                        selectedUnit={selectedUnits[itemKey]}
                        onUnitChange={(val: any) => setSelectedUnits(prev => ({ ...prev, [itemKey]: val }))}
                        quantity={quantities[itemKey]}
                        onIncrement={() => setQuantities(prev => ({ ...prev, [itemKey]: (prev[itemKey] || 0) + 1 }))}
                        onDecrement={() => setQuantities(prev => ({ ...prev, [itemKey]: Math.max(0, (prev[itemKey] || 0) - 1) }))}
                        remark={remarks[itemKey]}
                        onRemarkChange={(val: any) => setRemarks(prev => ({ ...prev, [itemKey]: val }))}
                        onRemarkBlur={() => handleRemarkBlur(item)}
                        onAdd={() => handleAddToAudit(item, false)} onDeduct={() => handleAddToAudit(item, true)}
                        selectedSubLocation={selectedSubLocation}
                    />
                );
              })}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="pt-6 pb-10 text-center">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">
                  Showing {searchResults.length} results
                </p>
                <Button variant="outline" onClick={() => setOffset(prev => prev + SEARCH_LIMIT)} disabled={searchLoading} className="rounded-xl h-12 px-8 font-bold text-[14px] bg-white border-slate-200 shadow-sm hover:bg-slate-50 hover:text-blue-700 transition-all active:scale-95">
                  {searchLoading ? "Loading..." : "Load More Results"}
                </Button>
              </div>
            )}
          </div>
        ) : hasNoResults ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 bg-white rounded-2xl border border-dashed border-slate-300 text-center shadow-sm">
            <div className="bg-amber-50 p-4 rounded-full mb-5 border border-amber-100">
              <AlertCircle className="h-10 w-10 text-amber-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Item Not Found</h3>
            <p className="text-[15px] font-medium text-slate-500 max-w-md mt-3 mb-8 leading-relaxed">
              This item does not exist in the current closing stock list. 
              If you found it physically, you can add it as a surplus item.
            </p>
            
            <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if(!open) setIsScanningNewItem(false); }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 px-8 shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] transition-all active:scale-95 font-bold text-[14px]" disabled={!isOnline}>
                  <PackagePlus className="mr-2 h-5 w-5" />
                  {isOnline ? "Add Surplus Item" : "Requires Internet to Add"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[460px] max-h-[90vh] overflow-y-auto rounded-[24px] border-slate-200 p-0 shadow-2xl">
                <DialogHeader className="p-8 pb-4 border-b border-slate-100 bg-white">
                  <DialogTitle className="text-2xl font-black tracking-tight text-slate-900">{isScanningNewItem ? "Scan Barcode" : "Add Surplus Item"}</DialogTitle>
                  <DialogDescription className="text-[14px] font-medium text-slate-500 mt-2">
                    {isScanningNewItem ? "Point your camera at the item's barcode." : "Add an item that was missing from the closing stock but found physically."}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="p-8 pt-6 bg-slate-50">
                    {isScanningNewItem ? (
                        <div className="py-2">
                            <BarcodeScanner 
                              onResult={(code) => {
                                  setNewItem(prev => ({ ...prev, sku: code }));
                                  setIsScanningNewItem(false);
                              }} 
                            />
                            <Button variant="outline" onClick={() => setIsScanningNewItem(false)} className="w-full mt-6 rounded-xl h-12 font-bold shadow-sm bg-white hover:bg-slate-100">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Form
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-5">
                          <div className="grid gap-2">
                            <Label htmlFor="sku" className="text-[11px] font-bold uppercase tracking-widest text-slate-500">SKU / Barcode <span className="text-rose-500">*</span></Label>
                            <div className="flex gap-3 relative">
                                <Input 
                                  id="sku" value={newItem.sku} onChange={(e) => setNewItem({...newItem, sku: e.target.value})}
                                  placeholder="e.g. 100256" className="h-12 rounded-xl border-slate-200 shadow-sm font-bold text-[14px] bg-white"
                                />
                                {isLookingUp && (
                                    <div className="absolute right-16 top-4">
                                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                    </div>
                                )}
                                <Button type="button" variant="outline" size="icon" title="Scan Barcode" onClick={() => setIsScanningNewItem(true)} className="h-12 w-12 shrink-0 rounded-xl border-slate-200 shadow-sm bg-white hover:bg-slate-100">
                                    <ScanBarcode className="h-5 w-5 text-blue-600" />
                                </Button>
                            </div>
                          </div>
                          
                          <div className="grid gap-2">
                            <Label htmlFor="name" className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Item Name <span className="text-rose-500">*</span></Label>
                            <Input id="name" value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} placeholder="e.g. Wireless Mouse" className="h-12 rounded-xl border-slate-200 shadow-sm font-bold text-[14px] bg-white" />
                          </div>
                          
                          <div className="grid gap-2">
                            <Label htmlFor="category" className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Category <span className="text-rose-500">*</span></Label>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger className="h-12 rounded-xl border-slate-200 shadow-sm font-bold text-[14px] bg-white">
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                    {dynamicFormFields.categories.map(cat => <SelectItem key={cat} value={cat} className="font-medium py-2.5 cursor-pointer">{cat}</SelectItem>)}
                                    <SelectItem value="other" className="font-black text-blue-600 py-2.5 cursor-pointer">+ Add New Category</SelectItem>
                                </SelectContent>
                            </Select>
                          </div>

                          {selectedCategory === "other" && (
                              <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                                <Label htmlFor="customCat" className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Type New Category <span className="text-rose-500">*</span></Label>
                                <Input id="customCat" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="e.g. Peripherals" className="h-12 rounded-xl border-blue-200 focus-visible:ring-blue-500 shadow-sm font-bold text-[14px] bg-white" />
                              </div>
                          )}

                          {dynamicFormFields.customFields.length > 0 && (
                              <div className="mt-2 space-y-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100">Additional Attributes</h4>
                                  {dynamicFormFields.customFields.map(field => (
                                      <div key={field} className="grid gap-2">
                                          <Label htmlFor={`custom-${field}`} className="text-[12px] font-bold text-slate-700 capitalize">
                                              {field === 'unit_price' ? 'Rate / Unit Price' : field.replace(/_/g, ' ')}
                                          </Label>
                                          <Input 
                                              id={`custom-${field}`}
                                              type={field === 'unit_price' ? 'number' : 'text'}
                                              step={field === 'unit_price' ? '0.01' : undefined}
                                              className="h-11 text-[14px] font-medium border-slate-200 rounded-xl bg-slate-50 focus-visible:bg-white"
                                              value={newCustomAttributes[field] || ""}
                                              onChange={(e) => {
                                                  const val = e.target.value;
                                                  setNewCustomAttributes(prev => ({ ...prev, [field]: field === 'unit_price' ? (val ? parseFloat(val) : "") : val }))
                                              }}
                                              placeholder={field === 'unit_price' ? '0.00' : `Enter ${field.replace(/_/g, ' ')}`}
                                          />
                                      </div>
                                  ))}
                              </div>
                          )}

                          <div className="grid gap-2 mt-2">
                            <Label htmlFor="qty" className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Physical Quantity Found</Label>
                            <Input 
                              id="qty" type="number" step="any" min="0.01" value={newItem.physicalQuantity} 
                              onChange={(e) => { const val = e.target.value; setNewItem({ ...newItem, physicalQuantity: val === "" ? "" : parseFloat(val) }); }}
                              className="h-14 rounded-xl border-slate-200 shadow-sm font-black text-[18px] bg-white"
                            />
                          </div>
                          
                          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-[12px] font-medium text-amber-800 leading-relaxed shadow-sm mt-2">
                            <strong className="font-black uppercase tracking-widest text-[10px] block mb-1">System Note:</strong> 
                            System Quantity will be set to 0. A remark stating <em>"This item was not in the closing stock but it was there"</em> will be added automatically.
                          </div>
                        </div>
                    )}
                </div>
                
                {!isScanningNewItem && (
                    <DialogFooter className="p-6 border-t border-slate-100 bg-white rounded-b-[24px]">
                      <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl font-bold text-[14px] h-12 px-6 shadow-sm border-slate-200 hover:bg-slate-50">Cancel</Button>
                      <Button onClick={handleAddSurplus} className="rounded-xl font-bold text-[14px] h-12 px-8 bg-blue-600 hover:bg-blue-700 shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] transition-all active:scale-[0.98] text-white" disabled={!newItem.sku || !newItem.name || (!selectedCategory) || (selectedCategory === 'other' && !customCategory)}>
                        Save Surplus Item
                      </Button>
                    </DialogFooter>
                )}
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="text-center p-12 text-[12px] font-bold uppercase tracking-widest text-slate-400">
            Enter at least 2 characters to search inventory
          </div>
        )}
      </div>

      {/* 🔥 FLOATING BULK DELETE ACTION BAR */}
      {isAdmin && selectedItemIds.size > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-3 rounded-full shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5 border border-slate-800">
              <span className="font-bold text-[13px] tracking-wide whitespace-nowrap px-2">
                  {selectedItemIds.size} item(s) selected
              </span>
              <div className="h-5 w-px bg-slate-700"></div>
              <Button 
                  variant="destructive" 
                  size="sm" 
                  className="rounded-full shadow-none h-10 text-[12px] font-bold uppercase tracking-wider px-5 whitespace-nowrap bg-rose-600 hover:bg-rose-500 transition-colors"
                  onClick={handleBulkDelete}
              >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
              </Button>
              <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-full h-10 text-[12px] font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800 px-4 transition-colors"
                  onClick={() => setSelectedItemIds(new Set())}
              >
                  Clear
              </Button>
          </div>
      )}

    </div>
  );
};