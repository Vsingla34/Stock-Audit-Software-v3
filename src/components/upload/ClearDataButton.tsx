import { Button } from "@/components/ui/button";
import { useInventory } from "@/context/InventoryContext";
import { useUndoableAction } from "@/hooks/useUndoableAction";
import { Trash2 } from "lucide-react";

export const ClearDataButton = () => {
  const { clearAllData } = useInventory();
  const { trigger } = useUndoableAction();

  const handleClear = () => {
    trigger({
      message: "All inventory data will be permanently deleted.",
      delayMs: 5000,
      successMessage: "Inventory data cleared successfully.",
      errorMessage: "Failed to clear inventory data. Please try again.",
      onConfirm: async () => {
        await clearAllData();
      },
    });
  };

  return (
    <Button
      variant="destructive"
      className="w-full bg-red-600 hover:bg-red-700 text-white shadow-sm transition-all"
      onClick={handleClear}
    >
      <Trash2 className="mr-2 h-4 w-4" />
      Clear Company Inventory Data
    </Button>
  );
};