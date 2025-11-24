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
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            <span>Search Inventory</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 text-muted-foreground">
            <h3 className="text-lg font-semibold mb-2">No Access</h3>
            <p>You don't have access to any locations for searching inventory.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          <span>Search Inventory</span>
          {currentUser && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-2">
              Auditor: {currentUser.email || currentUser.name}
            </span>
          )}
          {!isAdmin && userAccessibleLocations.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (Limited to: {userAccessibleLocations.map(loc => loc.name).join(", ")})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 bg-blue-50 p-3 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Multi-Auditor Support:</strong> Your entries are tracked individually. 
            If multiple auditors audit the same item, all counts will be combined.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, SKU, or ID..."
            className="flex-1"
          />
          <Button type="submit">Search</Button>
        </form>

        {searchResults.length > 0 ? (
          <div className="border rounded-md">
            <div className="grid grid-cols-[1fr_auto] gap-4 p-4 font-medium border-b">
              <div>Item Details</div>
              <div className="text-right">Quantity</div>
            </div>
            {searchResults.map((item) => {
              const itemKey = getItemKey(item);
              
              
              const auditorEntries = item.auditorEntries || [];
              const currentUserEntry = auditorEntries.find(e => e.auditorId === currentUser?.id);
              
              return (
                <div key={itemKey} className="grid grid-cols-[1fr_auto] gap-4 p-4 border-b last:border-0">
                  <div>
                    <h3 className="font-medium">{item.name}</h3>
                    <div className="text-sm text-muted-foreground">SKU: {item.sku}</div>
                    <div className="text-sm text-muted-foreground">Location: {item.location}</div>
                    <div className="text-sm">System Quantity: {item.systemQuantity}</div>
                    
                    
                    {auditorEntries.length > 0 && (
                      <div className="mt-2 text-xs bg-gray-50 p-2 rounded border">
                        <strong>Auditor Breakdown:</strong>
                        {auditorEntries.map((entry, idx) => (
                          <div key={idx} className={entry.auditorId === currentUser?.id ? "text-blue-600 font-medium" : ""}>
                            • {entry.auditorName}: {entry.quantityFound}
                            {entry.auditorId === currentUser?.id && " (You)"}
                          </div>
                        ))}
                        <div className="mt-1 font-medium">
                          Total Physical: {item.physicalQuantity || 0}
                        </div>
                      </div>
                    )}
                    
                    {currentUserEntry && (
                      <div className="mt-1 text-xs text-blue-600">
                        Your current count: {currentUserEntry.quantityFound}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center space-x-2 mb-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => decrementQuantity(item)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">
                        {quantities[itemKey] || 0}
                      </span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => incrementQuantity(item)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button 
                      variant="secondary"
                      size="sm"
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
          <div className="text-center p-8 text-muted-foreground">
            No results found for "{searchQuery}"
            {!isAdmin && (
              <div className="text-sm mt-1">
                (Search limited to your assigned locations)
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-8 text-muted-foreground">
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