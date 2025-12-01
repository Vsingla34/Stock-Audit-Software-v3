import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

export const ExampleData = () => {
  const itemMasterTemplate = 
`sku,name,category
ITEM1001,Laptop Dell XPS 15,Electronics
ITEM1002,Office Chair,Furniture
ITEM1003,Wireless Keyboard,Electronics
ITEM1004,LED Monitor 27",Electronics
ITEM1005,Standing Desk,Furniture`;

  const closingStockTemplate = 
`sku,systemQuantity,location,name,category
ITEM1001,25,Warehouse A,Laptop Dell XPS 15,Electronics
ITEM1002,15,Warehouse B,Office Chair,Furniture
ITEM1003,50,Warehouse A,Wireless Keyboard,Electronics
ITEM1004,30,Warehouse A,LED Monitor 27",Electronics
ITEM1005,10,Warehouse C,Standing Desk,Furniture`;

  const downloadTemplate = (data: string, filename: string) => {
    const blob = new Blob([data], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast.success(`${filename} downloaded`, {
      description: "Sample template has been downloaded"
    });
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 mt-6">
      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <FileText className="h-5 w-5 text-indigo-600" />
            Sample Item Master Template
          </CardTitle>
          <CardDescription className="text-gray-500">
            Download a sample CSV template for your Item Master data (without quantities).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Required columns: sku, name, category, location
          </p>
          <Button 
            variant="outline" 
            className="w-full border-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            onClick={() => downloadTemplate(itemMasterTemplate, "item_master_template.csv")}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <FileText className="h-5 w-5 text-indigo-600" />
            Sample Closing Stock Template
          </CardTitle>
          <CardDescription className="text-gray-500">
            Download a sample CSV template for your Closing Stock data (with quantities).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            Required columns: sku, systemQuantity, location. Optional: name, category.
          </p>
          <Button 
            variant="outline" 
            className="w-full border-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
            onClick={() => downloadTemplate(closingStockTemplate, "closing_stock_template.csv")}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};