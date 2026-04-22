import { useState, useEffect, useMemo } from "react";
import { useInventory, InventoryItem } from "@/context/InventoryContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, Minus, MapPin, AlertCircle, PackagePlus, ScanBarcode, ArrowLeft, Check, ChevronsUpDown, MessageSquare, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/context/UserContext";
import { useCompany } from "@/context/CompanyContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BarcodeScanner } from "@/components/scanner/BarcodeScanner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

import { SyncStatusBanner } from "@/components/scanner/SyncStatusBanner";

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
  
  // 🔥 DYNAMIC FORM STATE
  const [newItem, setNewItem] = useState({
    sku: "",
    name: "",
    physicalQuantity: 1 as number | string
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [customCategory, setCustomCategory] = useState<string>("");
  
  // 🔥 FIX: Changed Record<string, string> to Record<string, any> to support numeric rate field
  const [newCustomAttributes, setNewCustomAttributes] = useState<Record<string, any>>({});
  
  const [globalCategories, setGlobalCategories] = useState<string[]>([]);
  const [globalCustomFields, setGlobalCustomFields] = useState<string[]>([]);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lastAutoFilledSku, setLastAutoFilledSku] = useState("");

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const { 
    itemMaster,
    searchItem, 
    addItemToAudit, 
    addSurplusItem, 
    assignments, 
    locations, 
    activeSubLocations, 
    fetchSubLocations,  
    addSubLocationToDb,
    updateItemRemark,
    fetchGlobalItem
  } = useInventory();

  const { currentUser, user } = useUser();
  const { selectedCompanyId, selectedAssignmentId } = useCompany();

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const currentAssignment = assignments.find(a => String(a.id) === String(selectedAssignmentId));
  const activeLocationId = currentAssignment?.locationId;
  const activeLocationName = locations.find(l => String(l.id) === String(activeLocationId))?.name;

  const isAuditor = currentUser?.role === 'auditor';
  const hideSystemQuantity = isAuditor && currentAssignment?.showSystemQuantity === false;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (activeLocationId && isOnline) {
        fetchSubLocations(activeLocationId, subLocationSearchQuery).catch(console.error);
    }
  }, [activeLocationId, subLocationSearchQuery, fetchSubLocations, isOnline]); 

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 🔥 FETCH GLOBAL FIELDS
  useEffect(() => {
    let isMounted = true;
    const fetchGlobalFields = async () => {
        if (!selectedCompanyId || !isOnline) return;
        try {
            const { data } = await supabase
                .from('inventory_items')
                .select('category, custom_attributes')
                .eq('company_id', selectedCompanyId);
                
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
        } catch (e) {
            console.error("Failed to fetch global fields", e);
        }
    };
    
    fetchGlobalFields();
    return () => { isMounted = false; };
  }, [selectedCompanyId, isOnline]);

  // 🔥 AUTO-LOOKUP SURPLUS ITEM BY SKU
  useEffect(() => {
    const lookupSku = async () => {
        const currentSku = newItem.sku.trim();
        if (currentSku && currentSku.length >= 2 && isOnline && currentSku !== lastAutoFilledSku) {
            setIsLookingUp(true);
            try {
                const globalItem = await fetchGlobalItem(currentSku);
                if (globalItem) {
                    setNewItem(prev => ({
                        ...prev, 
                        name: prev.name || globalItem.name || ""
                    }));
                    if (globalItem.category && !selectedCategory) {
                        setSelectedCategory(globalItem.category);
                    }
                    if (globalItem.customAttributes || globalItem.custom_attributes) {
                        const attrs = globalItem.customAttributes || globalItem.custom_attributes || {};
                        setNewCustomAttributes(prev => ({...attrs, ...prev}));
                    }
                    setLastAutoFilledSku(currentSku);
                    toast.success("Auto-filled details from Master Database!");
                }
            } catch(e) {
                // silently ignore lookup failures
            } finally {
                setIsLookingUp(false);
            }
        }
    };
    
    const timer = setTimeout(lookupSku, 800);
    return () => clearTimeout(timer);
  }, [newItem.sku, isOnline, lastAutoFilledSku, fetchGlobalItem, selectedCategory]);

  const searchResults = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      return [];
    }

    const lowerCaseQuery = debouncedQuery.toLowerCase();
    
    let results = itemMaster.filter(item => 
        item.id?.toLowerCase().includes(lowerCaseQuery) ||
        item.sku?.toLowerCase().includes(lowerCaseQuery) ||
        item.name?.toLowerCase().includes(lowerCaseQuery) ||
        item.category?.toLowerCase().includes(lowerCaseQuery)
    );

    if (activeLocationName) {
        const cleanActiveLocation = activeLocationName.trim().toLowerCase();
        results = results.filter(item => {
            const cleanItemLocation = (item.location || "").trim().toLowerCase();
            return cleanItemLocation === cleanActiveLocation;
        });
    }

    return results;
  }, [debouncedQuery, itemMaster, activeLocationName]);

  // 🔥 THE FIX: CASE-INSENSITIVE DEDUPLICATION MAPS + RATE FIELD GUARANTEE
  const dynamicFormFields = useMemo(() => {
    const categoriesMap = new Map<string, string>();
    const attributesMap = new Map<string, string>();
    const excludedKeys = ['unit price', 'unit_price', 'price', 'rate', 'cost', 'mrp', 'unit cost', 'system_value', 'physical_value'];

    // 1. Add Global fields
    globalCategories.forEach(c => {
        if (c) categoriesMap.set(c.trim().toLowerCase(), c.trim());
    });
    globalCustomFields.forEach(f => {
        if (f) attributesMap.set(f.trim().toLowerCase(), f.trim());
    });

    // 2. Add Local Item Master fields
    itemMaster.forEach(item => {
        if (item.category) {
            const cat = item.category.trim();
            if (!categoriesMap.has(cat.toLowerCase())) {
                categoriesMap.set(cat.toLowerCase(), cat);
            }
        }
        if (item.customAttributes) {
            Object.keys(item.customAttributes).forEach(key => {
                const cleanKey = key.trim();
                if (!excludedKeys.includes(cleanKey.toLowerCase())) {
                    if (!attributesMap.has(cleanKey.toLowerCase())) {
                        attributesMap.set(cleanKey.toLowerCase(), cleanKey);
                    }
                }
            });
        }
    });

    // 🔥 Guarantee that the Rate/unit_price field is always rendered
    if (!attributesMap.has('unit_price')) {
        attributesMap.set('unit_price', 'unit_price');
    }

    return {
        categories: Array.from(categoriesMap.values()).sort(),
        customFields: Array.from(attributesMap.values()).sort()
    };
  }, [itemMaster, globalCategories, globalCustomFields]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedQuery(searchQuery);
  };

  const getItemKey = (item: InventoryItem) => `${item.id}-${item.location}`;

  const incrementQuantity = (item: InventoryItem) => {
    const itemKey = getItemKey(item);
    setQuantities(prev => ({
      ...prev,
      [itemKey]: (prev[itemKey] || 0) + 1
    }));
  };

  const decrementQuantity = (item: InventoryItem) => {
    const itemKey = getItemKey(item);
    if ((quantities[itemKey] || 0) > 0) {
      setQuantities(prev => ({
        ...prev,
        [itemKey]: prev[itemKey] - 1
      }));
    }
  };

  const handleAddSubLocation = async () => {
        if (!isOnline) {
            toast.error("Offline", { description: "Cannot create new sub-locations while offline." });
            return;
        }
        if (!newSubLocation.trim()) return;
        if (!activeLocationId) {
            toast.error("No active location found");
            return;
        }

        try {
            await addSubLocationToDb(newSubLocation.trim(), activeLocationId);
            setSelectedSubLocation(newSubLocation.trim());
            setNewSubLocation("");
            toast.success(`Sub-location saved: ${newSubLocation.trim()}`);
        } catch (error) {
            toast.error("Failed to save sub-location");
        }
  };

  const handleRemarkBlur = async (item: InventoryItem) => {
    const itemKey = getItemKey(item);
    const currentRemark = remarks[itemKey];
    
    if (currentRemark !== undefined && currentRemark !== (item.clientRemarks || "")) {
        try {
            await updateItemRemark(item.id, currentRemark);
            toast.success("Remark updated");
        } catch (e) {
            toast.error("Failed to save remark");
        }
    }
  };

  const handleAddToAudit = async (item: InventoryItem, isDeduction: boolean = false) => {
    if (!selectedSubLocation) {
        toast.error("Sub-Location Required", { description: "Please select a Box, Row, or Rack before adding." });
        return;
    }
    const itemKey = getItemKey(item);
    
    let inputQuantity = 0;
    let unitText = "";

    if (isDecimalMode) {
        inputQuantity = parseFloat(decimalQuantities[itemKey]) || 0;
        
        const itemUploadedUnit = item.customAttributes?.['Unit'];
        const finalUnit = selectedUnits[itemKey] !== undefined ? selectedUnits[itemKey] : (itemUploadedUnit || "none");
        
        if (finalUnit !== "none") unitText = ` ${finalUnit}`;
    } else {
        inputQuantity = quantities[itemKey] || 0;
    }

    if (inputQuantity <= 0) {
        toast.error("Invalid Quantity", { description: "Input must be greater than 0." });
        return;
    }
    
    const quantityToApply = isDeduction ? -Math.abs(inputQuantity) : Math.abs(inputQuantity);

    try {
      const activeName = currentUser?.email || currentUser?.name || user?.email || "Unknown Auditor";
      await addItemToAudit(
        item, 
        quantityToApply,
        currentUser?.id || user?.id,
        activeName,
        selectedSubLocation
      );
      
      const currentRemark = remarks[itemKey] !== undefined ? remarks[itemKey] : (item.clientRemarks || "");
      if (currentRemark !== (item.clientRemarks || "")) {
          await updateItemRemark(item.id, currentRemark);
      }

      toast.success(isDeduction ? "Quantity Deducted" : "Item added to audit", {
        description: `${isDeduction ? 'Removed' : 'Added'} ${Math.abs(quantityToApply)}${unitText} for ${item.name} at ${selectedSubLocation}`
      });

      if (isDecimalMode) {
          setDecimalQuantities(prev => ({ ...prev, [itemKey]: "" }));
      } else {
          setQuantities(prev => ({ ...prev, [itemKey]: 0 }));
      }

    } catch (error: any) {
      toast.error(isDeduction ? "Failed to deduct item" : "Failed to add item", {
        description: error.message || "An error occurred"
      });
    }
  };

  const handleAddSurplus = async () => {
    if (!newItem.sku || !newItem.name) {
        toast.error("SKU and Name are required");
        return;
    }
    
    const finalCategory = selectedCategory === "other" ? customCategory : selectedCategory;
    if (!finalCategory) {
        toast.error("Please select or enter a category");
        return;
    }

    try {
      const submissionItem = {
          ...newItem,
          category: finalCategory,
          physicalQuantity: Number(newItem.physicalQuantity) || 0,
          customAttributes: newCustomAttributes 
      };
      
      await addSurplusItem(submissionItem);
      
      toast.success("Surplus item added successfully");
      setIsAddOpen(false);
      setSearchQuery(newItem.sku); 
      
      setNewItem({ sku: "", name: "", physicalQuantity: 1 });
      setSelectedCategory("");
      setCustomCategory("");
      setNewCustomAttributes({});
    } catch (error: any) {
      toast.error("Failed to add surplus item", {
        description: error.message
      });
    }
  };

  const hasNoResults = debouncedQuery.length >= 2 && searchResults.length === 0;

  return (
    <div className="flex flex-col gap-4">
      
      <SyncStatusBanner />

      <Card className="w-full shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Search className="h-5 w-5" />
            <span>Search Inventory</span>
            {currentUser && (
              <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full ml-2">
                Auditor: {currentUser.email || currentUser.name}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 bg-indigo-50 p-3 rounded-lg border border-indigo-200">
            <p className="text-sm text-indigo-800">
              <strong>Multi-Auditor Support:</strong> Your entries are tracked individually. 
              If multiple auditors audit the same item, all counts will be combined.
            </p>
          </div>

          {activeLocationName && (
              <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      Searching in: <strong>{activeLocationName}</strong>
                  </div>

                  <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                      <Label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">
                          Audit Sub-Location (Box / Row / Rack)
                      </Label>
                      <div className="flex gap-2 mb-2">
                          <Input 
                              placeholder="Add Sub-Location (e.g. Box 5)" 
                              value={newSubLocation}
                              onChange={(e) => setNewSubLocation(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddSubLocation()}
                              className="bg-white"
                              disabled={!isOnline}
                          />
                          <Button variant="outline" onClick={handleAddSubLocation} size="icon" disabled={!isOnline}>
                              <Plus className="h-4 w-4" />
                          </Button>
                      </div>
                      
                      <Popover open={subLocationSearchOpen} onOpenChange={setSubLocationSearchOpen}>
                          <PopoverTrigger asChild>
                              <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={subLocationSearchOpen}
                                  className="w-full justify-between bg-white text-gray-700 font-normal"
                              >
                                  {selectedSubLocation
                                      ? selectedSubLocation
                                      : "Select active sub-location..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                              <Command shouldFilter={false}>
                                  <CommandInput 
                                      placeholder="Search sub-location..." 
                                      value={subLocationSearchQuery}
                                      onValueChange={setSubLocationSearchQuery}
                                  />
                                  <CommandList>
                                      <CommandEmpty>No sub-location found.</CommandEmpty>
                                      <CommandGroup>
                                          {activeSubLocations.map((sl) => (
                                              <CommandItem
                                                  key={sl}
                                                  value={sl}
                                                  onSelect={(currentValue) => {
                                                      setSelectedSubLocation(currentValue);
                                                      setSubLocationSearchOpen(false);
                                                  }}
                                              >
                                                  <Check
                                                      className={cn(
                                                          "mr-2 h-4 w-4",
                                                          selectedSubLocation === sl ? "opacity-100" : "opacity-0"
                                                      )}
                                                  />
                                                  {sl}
                                              </CommandItem>
                                          ))}
                                      </CommandGroup>
                                  </CommandList>
                              </Command>
                          </PopoverContent>
                      </Popover>
                      {!selectedSubLocation && <p className="text-xs text-red-500 mt-1 ml-1">* Required to add items</p>}
                  </div>
              </div>
          )}

          <div className="flex items-center gap-2 mb-4 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
              <input 
                  type="checkbox" 
                  id="decimal-mode-search" 
                  checked={isDecimalMode} 
                  onChange={(e) => setIsDecimalMode(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-600 cursor-pointer"
              />
              <Label htmlFor="decimal-mode-search" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                  Enable decimal quantity & measuring units
              </Label>
          </div>

          <form onSubmit={handleSearch} className="mb-6 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Start typing to search (Name, SKU, or Category)..."
              className="w-full pl-9 focus:ring-indigo-600 focus:border-indigo-600"
            />
          </form>

          {searchResults.length > 0 ? (
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 p-4 font-medium border-b border-gray-200 bg-gray-50 text-gray-900 hidden md:grid">
                <div>Item Details</div>
                <div className="text-right">Audit Controls</div>
              </div>
              {searchResults.map((item) => {
                const itemKey = getItemKey(item);
                
                const auditorEntries = item.auditorEntries || [];
                const calculatedTotal = Number(auditorEntries.reduce((sum, entry) => sum + (entry.quantityFound || 0), 0).toFixed(4));

                const consolidatedMap = new Map();
                auditorEntries.forEach(entry => {
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
                const currentSelectedUnit = selectedUnits[itemKey] !== undefined ? selectedUnits[itemKey] : (itemUploadedUnit || "none");

                return (
                  <div key={itemKey} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 p-4 border-b border-gray-100 last:border-0 items-start hover:bg-gray-50/50 transition-colors">
                    <div>
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <div className="text-sm text-gray-500">SKU: {item.sku}</div>
                      <div className="text-sm text-gray-500">Category: {item.category || '-'}</div>
                      
                      {!hideSystemQuantity ? (
                          <div className="text-sm text-gray-900 mt-1">System Quantity: {item.systemQuantity} {itemUploadedUnit}</div>
                      ) : (
                          <div className="text-sm text-gray-500 mt-1 italic flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" /> System Quantity: Hidden
                          </div>
                      )}
                      
                      {consolidatedEntries.length > 0 && (
                        <div className="mt-2 text-xs bg-white p-2 rounded border border-gray-200 shadow-sm">
                          <strong className="text-gray-900 block mb-1">Auditor Breakdown:</strong>
                          {consolidatedEntries.map((entry, idx) => (
                            <div key={idx} className="flex justify-between items-center gap-2 text-gray-600">
                                <span className="truncate pr-2">窶｢ {entry.name} {entry.subLocation && `(${entry.subLocation})`}</span>
                                <span className="font-medium text-indigo-600">{entry.quantityFound}</span>
                            </div>
                          ))}
                          <div className="mt-2 pt-1 border-t border-gray-100 font-medium text-gray-900">
                            Total Physical: <span className="text-indigo-600">{calculatedTotal}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                      
                      {isDecimalMode ? (
                          <div className="flex items-center gap-2 mb-1 w-full justify-end">
                              <Input 
                                  type="number" 
                                  step="any" 
                                  placeholder="Qty" 
                                  value={decimalQuantities[itemKey] || ""} 
                                  onChange={(e) => setDecimalQuantities(prev => ({ ...prev, [itemKey]: e.target.value }))}
                                  className="w-24 h-9 font-medium"
                              />
                              <Select 
                                  value={currentSelectedUnit} 
                                  onValueChange={(val) => setSelectedUnits(prev => ({ ...prev, [itemKey]: val }))}
                              >
                                  <SelectTrigger className="w-[100px] h-9 bg-white">
                                      <SelectValue placeholder="Unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="none">No Unit</SelectItem>
                                      {itemUploadedUnit && (
                                          <SelectItem value={itemUploadedUnit}>{itemUploadedUnit}</SelectItem>
                                      )}
                                  </SelectContent>
                              </Select>
                          </div>
                      ) : (
                          <div className="flex items-center space-x-2 mb-1 bg-white rounded-md border border-gray-200 p-1 w-full md:w-auto justify-between md:justify-end">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 hover:bg-gray-100 text-gray-600"
                              onClick={() => decrementQuantity(item)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center font-medium text-gray-900">
                              {quantities[itemKey] || 0}
                            </span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 hover:bg-gray-100 text-gray-600"
                              onClick={() => incrementQuantity(item)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                      )}

                      <div className="w-full relative mb-2">
                        <MessageSquare className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                        <Input
                          placeholder="Add a remark (optional)..."
                          value={remarks[itemKey] !== undefined ? remarks[itemKey] : (item.clientRemarks || "")}
                          onChange={(e) => setRemarks(prev => ({ ...prev, [itemKey]: e.target.value }))}
                          onBlur={() => handleRemarkBlur(item)}
                          className="h-9 w-full md:w-[208px] pl-8 text-xs"
                        />
                      </div>

                      <div className="flex gap-2 w-full md:w-[208px]">
                        {isAdmin && (
                            <Button 
                              variant="destructive"
                              size="sm"
                              className="flex-1 shadow-sm px-2"
                              onClick={() => handleAddToAudit(item, true)}
                              disabled={isDecimalMode ? !(parseFloat(decimalQuantities[itemKey]) > 0) || !selectedSubLocation : !(quantities[itemKey] > 0) || !selectedSubLocation}
                              title="Deduct this quantity from the total"
                            >
                              <Minus className="h-4 w-4 mr-1" /> Deduct
                            </Button>
                        )}
                        <Button 
                          variant="default"
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex-1"
                          onClick={() => handleAddToAudit(item, false)}
                          disabled={isDecimalMode ? !(parseFloat(decimalQuantities[itemKey]) > 0) || !selectedSubLocation : !(quantities[itemKey] > 0) || !selectedSubLocation}
                        >
                          <Check className="h-4 w-4 mr-1" /> Add
                        </Button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          ) : hasNoResults ? (
            <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <div className="bg-white p-3 rounded-full shadow-sm mb-3">
                <AlertCircle className="h-8 w-8 text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Item not found in this audit</h3>
              <p className="text-gray-500 max-w-md text-center mb-6">
                This item does not exist in the current closing stock list. 
                If you found it physically, you can add it as a surplus item.
              </p>
              
              <Dialog open={isAddOpen} onOpenChange={(open) => {
                setIsAddOpen(open);
                if(!open) setIsScanningNewItem(false); 
              }}>
                <DialogTrigger asChild>
                  <Button 
                    className="bg-indigo-600 hover:bg-indigo-700" 
                    disabled={!isOnline} 
                  >
                    <PackagePlus className="mr-2 h-4 w-4" />
                    {isOnline ? "Add New Item" : "Requires Internet to Add"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{isScanningNewItem ? "Scan Barcode" : "Add Surplus Item"}</DialogTitle>
                    <DialogDescription>
                      {isScanningNewItem 
                        ? "Point your camera at the item's barcode." 
                        : "Add an item that was missing from the closing stock but found physically."}
                    </DialogDescription>
                  </DialogHeader>
                  
                  {isScanningNewItem ? (
                      <div className="py-2">
                          <BarcodeScanner 
                            onResult={(code) => {
                                setNewItem(prev => ({ ...prev, sku: code }));
                                setIsScanningNewItem(false);
                            }} 
                          />
                          <Button 
                              variant="outline" 
                              onClick={() => setIsScanningNewItem(false)}
                              className="w-full mt-4"
                          >
                              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Form
                          </Button>
                      </div>
                  ) : (
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="sku">SKU / Barcode <span className="text-red-500">*</span></Label>
                          <div className="flex gap-2 relative">
                              <Input 
                                id="sku" 
                                value={newItem.sku} 
                                onChange={(e) => setNewItem({...newItem, sku: e.target.value})}
                                placeholder="e.g. 100256"
                              />
                              {isLookingUp && (
                                  <div className="absolute right-12 top-2.5">
                                      <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                                  </div>
                              )}
                              <Button 
                                  type="button" 
                                  variant="outline" 
                                  size="icon"
                                  title="Scan Barcode"
                                  onClick={() => setIsScanningNewItem(true)}
                              >
                                  <ScanBarcode className="h-4 w-4 text-indigo-600" />
                              </Button>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="name">Item Name <span className="text-red-500">*</span></Label>
                          <Input 
                            id="name" 
                            value={newItem.name} 
                            onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                            placeholder="e.g. Wireless Mouse"
                          />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="category">Category <span className="text-red-500">*</span></Label>
                          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                              <SelectTrigger>
                                  <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                              <SelectContent>
                                  {dynamicFormFields.categories.map(cat => (
                                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                  ))}
                                  <SelectItem value="other" className="font-bold text-indigo-600">
                                      + Add New Category (Other)
                                  </SelectItem>
                              </SelectContent>
                          </Select>
                        </div>

                        {selectedCategory === "other" && (
                            <div className="grid gap-2">
                              <Label htmlFor="customCat">Type New Category <span className="text-red-500">*</span></Label>
                              <Input 
                                id="customCat" 
                                value={customCategory} 
                                onChange={(e) => setCustomCategory(e.target.value)}
                                placeholder="e.g. Peripherals"
                                className="border-indigo-300 focus-visible:ring-indigo-500"
                              />
                            </div>
                        )}

                        {/* 🔥 RENDER DYNAMIC CUSTOM FIELDS + RATE FIELD */}
                        {dynamicFormFields.customFields.length > 0 && (
                            <div className="mt-2 space-y-3 p-3 bg-gray-50 border border-gray-100 rounded-md">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Additional Attributes</h4>
                                {dynamicFormFields.customFields.map(field => (
                                    <div key={field} className="grid gap-1.5">
                                        <Label htmlFor={`custom-${field}`} className="text-xs capitalize">
                                            {field === 'unit_price' ? 'Rate / Unit Price' : field.replace(/_/g, ' ')}
                                        </Label>
                                        <Input 
                                            id={`custom-${field}`}
                                            type={field === 'unit_price' ? 'number' : 'text'}
                                            step={field === 'unit_price' ? '0.01' : undefined}
                                            className="h-8 text-sm bg-white"
                                            value={newCustomAttributes[field] || ""}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setNewCustomAttributes(prev => ({
                                                    ...prev, 
                                                    [field]: field === 'unit_price' ? (val ? parseFloat(val) : "") : val
                                                }))
                                            }}
                                            placeholder={field === 'unit_price' ? '0.00' : `Enter ${field.replace(/_/g, ' ')}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="grid gap-2 mt-2">
                          <Label htmlFor="qty">Physical Quantity Found</Label>
                          <Input 
                            id="qty" 
                            type="number"
                            step="any"
                            min="0.01"
                            value={newItem.physicalQuantity} 
                            onChange={(e) => {
                                const val = e.target.value;
                                setNewItem({
                                    ...newItem,
                                    physicalQuantity: val === "" ? "" : parseFloat(val)
                                });
                            }}
                          />
                        </div>
                        
                        <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 text-xs text-yellow-800">
                          <strong>Note:</strong> System Quantity will be set to 0. 
                          Remark "This item was not in the closing stock but it was there" will be added automatically.
                        </div>
                      </div>
                  )}

                  {!isScanningNewItem && (
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddSurplus} disabled={!newItem.sku || !newItem.name || (!selectedCategory) || (selectedCategory === 'other' && !customCategory)}>
                          Add Item
                        </Button>
                      </DialogFooter>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500">
              Enter at least 2 characters to search
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};