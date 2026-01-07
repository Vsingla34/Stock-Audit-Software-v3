import { useEffect, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { UploadHistory } from "./UploadHistory";
import { useCompany } from "@/context/CompanyContext";
import SupabaseDataService from "@/services/SupabaseDataService";

interface ImportSectionProps {
  canUploadItemMaster?: boolean;
  canUploadClosingStock?: boolean;
  showLocationInfo?: boolean;
  refreshTrigger?: number; // NEW PROP
}

export const ImportSection = ({
  canUploadItemMaster,
  canUploadClosingStock,
  showLocationInfo = true,
  refreshTrigger = 0
}: ImportSectionProps) => {
  
  const { selectedCompanyId } = useCompany();
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = async () => {
    if (!selectedCompanyId) return;
    try {
        setIsLoading(true);
        const data = await SupabaseDataService.getUploadHistory(selectedCompanyId);
        setHistory(data || []);
    } catch (error) {
        console.error("Failed to fetch upload history", error);
    } finally {
        setIsLoading(false);
    }
  };

  // Re-fetch whenever company changes OR refreshTrigger updates
  useEffect(() => {
    fetchHistory();
  }, [selectedCompanyId, refreshTrigger]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border shadow-sm p-4">
        <h3 className="text-lg font-semibold mb-2">Import Instructions</h3>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-sm text-gray-600">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    View File Format Requirements
                </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {canUploadItemMaster && (
                <div className="space-y-2">
                    <h4 className="font-medium text-indigo-700">Item Master CSV</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        <li>Required Columns: <code className="bg-gray-100 px-1 rounded">sku</code>, <code className="bg-gray-100 px-1 rounded">name</code></li>
                        <li>Optional: <code className="bg-gray-100 px-1 rounded">category</code>, <code className="bg-gray-100 px-1 rounded">price</code></li>
                        <li>Do not include quantities in Item Master.</li>
                    </ul>
                </div>
              )}
              {canUploadClosingStock && (
                <div className="space-y-2">
                    <h4 className="font-medium text-emerald-700">Closing Stock CSV</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        <li>Required Columns: <code className="bg-gray-100 px-1 rounded">sku</code>, <code className="bg-gray-100 px-1 rounded">systemQuantity</code></li>
                        <li>Note: SKUs must match exactly with Item Master.</li>
                    </ul>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* HISTORY SECTION */}
      <div className="mt-8">
         <UploadHistory history={history} onDelete={fetchHistory} />
      </div>
    </div>
  );
};