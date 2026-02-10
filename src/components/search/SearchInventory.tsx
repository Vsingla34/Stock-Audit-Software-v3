import { useState, useEffect, useCallback } from "react";
import { useInventory, InventoryItem } from "@/context/InventoryContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, Minus, MapPin, AlertCircle, PackagePlus, ScanBarcode, ArrowLeft } from "lucide-react";
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

export const SearchInventory = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  
  // Sub-Location State
  const [newSubLocation, setNewSubLocation] = useState("");
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>("");

  // New State for Add Dialog
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isScanningNewItem, setIsScanningNewItem] = useState(false);
  const [newItem, setNewItem] = useState({
    sku: "",
    name: "",
    category: "",
    physicalQuantity: 1
  });

  const { 
    searchItem, 
    addItemToAudit, 
    addSurplusItem, 
    assignments, 
    locations, 
    activeSubLocations, 
    fetchSubLocations,  
    addSubLocationToDb  
  } = useInventory();

  const { currentUser } = useUser();
  const { selectedAssignmentId } = useCompany();

  const currentAssignment = assignments.find(a => a.id === selectedAssignmentId);
  const activeLocationId = currentAssignment?.locationId;
  const activeLocationName = locations.find(l => l.id === activeLocationId)?.name;

  // Fetch sub-locations when location is identified
  useEffect(() => {
    if (activeLocationId) {
        fetchSubLocations(activeLocationId).catch(console.error);
        setSelectedSubLocation("");
    }
  }, [activeLocationId]); 

  const performSearch = useCallback((query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    const results = searchItem(query);
    let filteredResults = results;
    
    if (activeLocationName) {
        filteredResults = results.filter(item => item.location === activeLocationName);
    }
    
    setSearchResults(filteredResults);
    
    const newQuantities: Record<string, number> = {};
    filteredResults.forEach(item => {
      const key = `${item.id}-${item.location}`;
      newQuantities[key] = quantities[key] || 0;
    });
    setQuantities(newQuantities);

  }, [searchItem, activeLocationName, quantities]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      performSearch(searchQuery);
    }, 300); 

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, performSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
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
    if (quantities[itemKey] > 0) {
      setQuantities(prev => ({
        ...prev,
        [itemKey]: prev[itemKey] - 1
      }));
    }
  };

  const handleAddSubLocation = async () => {
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

  const handleAddToAudit = async (item: InventoryItem) => {
    if (!selectedSubLocation) {
        toast.error("Sub-Location Required", { description: "Please select a Box, Row, or Rack before adding." });
        return;
    }
    const itemKey = getItemKey(item);
    const quantity = quantities[itemKey] || 0;
    
    try {
      await addItemToAudit(
        item, 
        quantity,
        currentUser?.id,
        currentUser?.email || currentUser?.name || 'Unknown Auditor',
        selectedSubLocation
      );
      
      toast.success("Item added to audit", {
        description: `Added ${quantity} of ${item.name} to ${selectedSubLocation}`
      });
    } catch (error: any) {
      toast.error("Failed to add item", {
        description: error.message || "An error occurred"
      });
    }
  };

  const handleAddSurplus = async () => {
    if (!newItem.sku || !newItem.name) return;
    try {
      await addSurplusItem(newItem);
      toast.success("Surplus item added successfully");
      setIsAddOpen(false);
      setSearchQuery(newItem.sku); 
      setNewItem({ sku: "", name: "", category: "", physicalQuantity: 1 });
    } catch (error: any) {
      toast.error("Failed to add surplus item", {
        description: error.message
      });
    }
  };

  const hasNoResults = searchQuery.length >= 2 && searchResults.length === 0;

  return (
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
                        />
                        <Button variant="outline" onClick={handleAddSubLocation} size="icon">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    
                    <Select value={selectedSubLocation} onValueChange={setSelectedSubLocation}>
                        <SelectTrigger className="w-full bg-white">
                            <SelectValue placeholder="Select active sub-location..." />
                        </SelectTrigger>
                        <SelectContent>
                            {activeSubLocations.length === 0 ? (
                                <SelectItem value="default" disabled>Add a sub-location above</SelectItem>
                            ) : (
                                activeSubLocations.map((sl) => (
                                    <SelectItem key={sl} value={sl}>{sl}</SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                    {!selectedSubLocation && <p className="text-xs text-red-500 mt-1 ml-1">* Required to add items</p>}
                </div>
            </div>
        )}

        <form onSubmit={handleSearch} className="mb-6 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Start typing to search (Name, SKU, or ID)..."
            className="w-full pl-9 focus:ring-indigo-600 focus:border-indigo-600"
          />
        </form>

        {searchResults.length > 0 ? (
          <div className="border border-gray-200 rounded-md">
            <div className="grid grid-cols-[1fr_auto] gap-4 p-4 font-medium border-b border-gray-200 bg-gray-50 text-gray-900">
              <div>Item Details</div>
              <div className="text-right">Quantity</div>
            </div>
            {searchResults.map((item) => {
              const itemKey = getItemKey(item);
              
              const auditorEntries = item.auditorEntries || [];
              const currentUserEntry = auditorEntries.find(e => e.auditorId === currentUser?.id);
              
              const calculatedTotal = auditorEntries.reduce((sum, entry) => sum + (entry.quantityFound || 0), 0);

              return (
                <div key={itemKey} className="grid grid-cols-[1fr_auto] gap-4 p-4 border-b border-gray-100 last:border-0">
                  <div>
                    <h3 className="font-medium text-gray-900">{item.name}</h3>
                    <div className="text-sm text-gray-500">SKU: {item.sku}</div>
                    <div className="text-sm text-gray-500">Location: {item.location}</div>
                    <div className="text-sm text-gray-900">System Quantity: {item.systemQuantity}</div>
                    
                    {auditorEntries.length > 0 && (
                      <div className="mt-2 text-xs bg-gray-50 p-2 rounded border border-gray-200">
                        <strong className="text-gray-900">Auditor Breakdown:</strong>
                        {auditorEntries.map((entry, idx) => (
                          <div key={idx} className={entry.auditorId === currentUser?.id ? "text-indigo-600 font-medium" : "text-gray-600"}>
                            • {entry.auditorName} {entry.subLocation ? `(${entry.subLocation})` : ''}: {entry.quantityFound}
                            {entry.auditorId === currentUser?.id && " (You)"}
                          </div>
                        ))}
                        <div className="mt-1 font-medium text-gray-900">
                          Total Physical: {calculatedTotal}
                        </div>
                      </div>
                    )}
                    
                    {currentUserEntry && (
                      <div className="mt-1 text-xs text-indigo-600">
                        Your current count: {currentUserEntry.quantityFound}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center space-x-2 mb-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-indigo-50 hover:text-indigo-600 border-gray-200"
                        onClick={() => decrementQuantity(item)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-medium text-gray-900">
                        {quantities[itemKey] || 0}
                      </span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-indigo-50 hover:text-indigo-600 border-gray-200"
                        onClick={() => incrementQuantity(item)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button 
                      variant="secondary"
                      size="sm"
                      className="bg-white hover:bg-indigo-50 border border-gray-200 text-gray-700 hover:text-indigo-700 shadow-sm"
                      onClick={() => handleAddToAudit(item)}
                      disabled={!(quantities[itemKey] > 0) || !selectedSubLocation}
                    >
                      Add to Audit
                    </Button>
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
                <Button className="bg-indigo-600 hover:bg-indigo-700">
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Add New Item
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
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
                        <Label htmlFor="sku">SKU / Barcode</Label>
                        <div className="flex gap-2">
                            <Input 
                              id="sku" 
                              value={newItem.sku} 
                              onChange={(e) => setNewItem({...newItem, sku: e.target.value})}
                              placeholder="e.g. 100256"
                            />
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
                        <Label htmlFor="name">Item Name</Label>
                        <Input 
                          id="name" 
                          value={newItem.name} 
                          onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                          placeholder="e.g. Wireless Mouse"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="category">Category</Label>
                        <Input 
                          id="category" 
                          value={newItem.category} 
                          onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                          placeholder="e.g. Electronics"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="qty">Physical Quantity Found</Label>
                        <Input 
                          id="qty" 
                          type="number"
                          min="1"
                          value={newItem.physicalQuantity} 
                          onChange={(e) => setNewItem({...newItem, physicalQuantity: parseInt(e.target.value) || 0})}
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
                      <Button onClick={handleAddSurplus} disabled={!newItem.sku || !newItem.name}>
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
  );
};