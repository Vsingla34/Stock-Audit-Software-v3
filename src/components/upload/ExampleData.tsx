import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

interface ExampleDataProps {
  showSurplusTemplate?: boolean;
}

export const ExampleData = ({ showSurplusTemplate = false }: ExampleDataProps) => {
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

  const surplusTemplate = 
`sku,name,category,physical quantity,sub-location,Brand,Rate
NEW1001,Wireless Mouse,Electronics,5,Box A1,Logitech,25.50
NEW1002,Desk Organizer,Office Supplies,12,Shelf 2,Generic,15.00
NEW1003,HDMI Cable 2m,Electronics,20,General,AmazonBasics,8.99`;

 
  const physicalQtyTemplate = 
`sku,physicalQuantity
ITEM1001,25
ITEM1002,15
ITEM1003,52
ITEM1004,28
ITEM1005,10`;

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
    
    <div className={`grid gap-6 mt-6 ${showSurplusTemplate ? 'md:grid-cols-2 lg:grid-cols-2' : 'md:grid-cols-2'}`}>
      <Card className="shadow-sm border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <FileText className="h-5 w-5 text-indigo-600" />
            Sample Item Master
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
            Sample Closing Stock
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

    
      {showSurplusTemplate && (
        <>
          <Card className="shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <FileText className="h-5 w-5 text-indigo-600" />
                Sample Bulk New Items
              </CardTitle>
              <CardDescription className="text-gray-500">
                Download a sample CSV template for bulk adding surplus/new items directly to an audit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                Required: sku, name. Optional: physical quantity, sub-location, attributes.
              </p>
              <Button 
                variant="outline" 
                className="w-full border-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                onClick={() => downloadTemplate(surplusTemplate, "bulk_new_items_template.csv")}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-gray-200 bg-indigo-50 border-indigo-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-900">
                <FileText className="h-5 w-5 text-indigo-600" />
                Sample Physical Qty Sheet
              </CardTitle>
              <CardDescription className="text-indigo-700">
                Download a sample CSV template to upload reconciled physical counts for existing items.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-indigo-800 mb-4">
                Required columns: sku, physicalQuantity.
              </p>
              <Button 
                variant="default" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => downloadTemplate(physicalQtyTemplate, "physical_qty_template.csv")}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};