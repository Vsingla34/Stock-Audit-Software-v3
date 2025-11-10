// src/components/upload/UploadHistory.tsx
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useCompany } from "@/context/CompanyContext";
import SupabaseDataService from "../../services/SupabaseDataService";

type UploadHistoryRow = {
  id: string;
  batch_key: string;
  company_id: string | null;
  location_id: string | null;
  location_name: string | null;
  upload_type: string;
  total_items: number;
  uploaded_at: string;
};

export const UploadHistory = () => {
  const { selectedCompanyId } = useCompany();
  const [rows, setRows] = useState<UploadHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    if (!selectedCompanyId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const data = await SupabaseDataService.getUploadHistory(selectedCompanyId);
      setRows(data as UploadHistoryRow[]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load upload history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [selectedCompanyId]);

  const handleDelete = async (batchKey: string) => {
    const ok = window.confirm(
      "Delete all items from this upload? This cannot be undone."
    );
    if (!ok) return;

    try {
      const deletedCount = await SupabaseDataService.deleteUploadBatch(batchKey);

      if (!deletedCount) {
        toast.error(
          "No items were deleted for this upload. Please confirm upload_batch_key is stored correctly."
        );
        return;
      }

      setRows((prev) => prev.filter((r) => r.batch_key !== batchKey));
      toast.success(`Upload batch deleted (${deletedCount} items removed)`);
      // Optionally: trigger a refresh in InventoryContext here if needed
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete upload batch");
    }
  };

  if (!selectedCompanyId) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Upload History</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No uploads found for this company.
          </p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Uploaded At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="capitalize">
                      {row.upload_type.replace("_", " ")}
                    </TableCell>
                    <TableCell>{row.location_name || "-"}</TableCell>
                    <TableCell>{row.total_items}</TableCell>
                    <TableCell>
                      {format(new Date(row.uploaded_at), "dd MMM yyyy, HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(row.batch_key)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
