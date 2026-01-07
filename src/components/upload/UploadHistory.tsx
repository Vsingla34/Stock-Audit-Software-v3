import { useState } from "react";
import { Trash2, FileSpreadsheet, Calendar, MapPin, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import SupabaseDataService from "@/services/SupabaseDataService";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UploadHistoryProps {
  history: any[];
  onDelete: () => void;
}

export function UploadHistory({ history = [], onDelete }: UploadHistoryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this batch? This will remove all items associated with it.")) return;

    try {
      setDeletingId(id);
      await SupabaseDataService.deleteUploadBatch(id);
      toast.success("Upload batch removed");
      
      // Trigger parent refresh
      onDelete(); 
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to delete batch", { description: error.message });
    } finally {
      setDeletingId(null);
    }
  };

  if (!history || history.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center shadow-sm">
        <p className="text-gray-500">No upload history found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Upload History</h3>
        <span className="text-xs text-gray-500">Recent uploads</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>Type</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
                  <span className="capitalize">{item.upload_type?.replace('_', ' ') || 'Upload'}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="h-3 w-3" />
                  {item.location_name || 'Unknown'}
                </div>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  {item.total_items} items
                </span>
              </TableCell>
              <TableCell className="text-gray-600 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  {item.created_at ? format(new Date(item.created_at), "MMM dd, HH:mm") : "-"}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                >
                  {deletingId === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}