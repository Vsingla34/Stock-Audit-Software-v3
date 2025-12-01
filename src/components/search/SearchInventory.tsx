import { useState, useEffect } from "react";
import { useInventory, InventoryItem } from "@/context/InventoryContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { useLocationFilter } from "@/hooks/useLocationFilter";
import { useUser } from "@/context/UserContext";

export const SearchInventory = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  
  const { searchItem, addItemToAudit } = useInventory();
  const { currentUser } = useUser();
  
  const { 
    isAdmin, 
    userAccessibleLocations 
  } = useLocationFilter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (searchQuery.length >= 2) {
      const results = searchItem(searchQuery);
      
      let filteredResults = results;
      
      if (!isAdmin) {
        const accessibleLocationNames = userAccessibleLocations.map(loc => loc.name);
        filteredResults = results.filter(item => 
          accessibleLocationNames.includes(item.location)
        );
      }
      
      setSearchResults(filteredResults);
      
      const newQuantities: Record<string, number> = {};
      filteredResults.forEach(item => {
        newQuantities[`${item.id}-${item.location}`] = quantities[`${item.id}-${item.location}`] || 0;
      });
      setQuantities(newQuantities);
    }
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

  const handleAddToAudit = async (item: InventoryItem) => {
    const itemKey = getItemKey(item);
    const quantity = quantities[itemKey] || 0;
    
    try {
      await addItemToAudit(
        item, 
        quantity,
        currentUser?.id,
        currentUser?.email || currentUser?.name || 'Unknown Auditor'
      );
      
      toast.success("Item added to audit", {
        description: `Added ${quantity} of ${item.name} at ${item.location} as ${currentUser?.email || currentUser?.name}`
      });
    } catch (error: any) {
      toast.error("Failed to add item", {
        description: error.message || "An error occurred"
      });
    }
  };

  useEffect(() => {
    if (!isAdmin && userAccessibleLocations.length === 0) {
      setSearchResults([]);
      setSearchQuery("");
    }
  }, [isAdmin, userAccessibleLocations]);

  if (!isAdmin && userAccessibleLocations.length === 0) {
    return (
      <Card className="w-full shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Search className="h-5 w-5" />
            <span>Search Inventory</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 text-gray-500">
            <h3 className="text-lg font-semibold mb-2 text-gray-900">No Access</h3>
            <p>You don't have access to any locations for searching inventory.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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
          {!isAdmin && userAccessibleLocations.length > 0 && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              (Limited to: {userAccessibleLocations.map(loc => loc.name).join(", ")})
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

        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, SKU, or ID..."
            className="flex-1 focus:ring-indigo-600 focus:border-indigo-600"
          />
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Search
          </Button>
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
                            • {entry.auditorName}: {entry.quantityFound}
                            {entry.auditorId === currentUser?.id && " (You)"}
                          </div>
                        ))}
                        <div className="mt-1 font-medium text-gray-900">
                          Total Physical: {item.physicalQuantity || 0}
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
                      disabled={!(quantities[itemKey] > 0)}
                    >
                      Add to Audit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : searchQuery.length >= 2 ? (
          <div className="text-center p-8 text-gray-500">
            No results found for "{searchQuery}"
            {!isAdmin && (
              <div className="text-sm mt-1">
                (Search limited to your assigned locations)
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-8 text-gray-500">
            Enter at least 2 characters to search
            {!isAdmin && userAccessibleLocations.length > 0 && (
              <div className="text-sm mt-2">
                You can search items from: {userAccessibleLocations.map(loc => loc.name).join(", ")}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};