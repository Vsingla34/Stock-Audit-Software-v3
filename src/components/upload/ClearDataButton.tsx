import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInventory } from "@/context/InventoryContext";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const ClearDataButton = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { clearAllData } = useInventory();

  const handleClear = () => {
    try {
      clearAllData();
      setDialogOpen(false);
      toast.success("Inventory data cleared successfully");
    } catch (error) {
      toast.error("Failed to clear inventory data");
      console.error("Error clearing data:", error);
    }
  };

  return (
    <>
      <Button 
        variant="destructive" 
        className="w-full bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all" 
        onClick={() => setDialogOpen(true)}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Clear Company Inventory Data
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Clear Company Inventory Data</DialogTitle>
            <DialogDescription className="text-gray-500">
              Are you sure you want to clear all inventory data? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setDialogOpen(false)}
              className="border-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleClear}
              className="bg-red-600 hover:bg-red-700 text-white shadow-sm"
            >
              Delete All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};