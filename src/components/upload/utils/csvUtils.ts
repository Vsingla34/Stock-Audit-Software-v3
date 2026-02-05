import { InventoryItem, Location } from "@/context/InventoryContext";
import Papa from "papaparse";

export interface CSVRow {
  [key: string]: string;
}

export const processCSV = (csvText: string): CSVRow[] => {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    delimitersToGuess: [',', '\t', '|', ';'],
  });

  if (result.errors.length > 0) {
    console.error("CSV parsing errors:", result.errors);
  }

  const cleanedData = result.data.map((row: any) => {
    const cleanedRow: CSVRow = {};
    Object.keys(row).forEach(key => {
      const cleanKey = key.trim().toLowerCase();
      cleanedRow[cleanKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
    });
    return cleanedRow;
  });

  return cleanedData;
};

// Helper to parse price
const parsePrice = (val: any): number => {
  if (!val) return 0;
  // Remove currency symbols, commas, keep dots/digits
  const cleanStr = String(val).replace(/[^0-9.-]+/g, "");
  return parseFloat(cleanStr) || 0;
};

export const processItemMasterData = (rows: CSVRow[]): Omit<InventoryItem, 'id'>[] => {
  return rows.map((row, index) => {
    const sku = row['sku'] || row['item code'];
    if (!sku) {
      throw new Error(`Row ${index + 2} in Item Master is missing 'sku' column.`);
    }

    const name = row['name'] || row['item name'] || row['description'] || 'Unnamed Item';
    const category = row['category'] || row['type'] || '';
    
    // Quantity logic (if included in master upload)
    const quantityStr = row['systemquantity'] || row['system quantity'] || row['quantity'] || row['qty'] || '0';
    const systemQuantity = parseInt(quantityStr, 10) || 0;

    const knownKeys = ['sku', 'item code', 'name', 'item name', 'description', 'category', 'type', 'systemquantity', 'system quantity', 'quantity', 'qty', 'location', 'warehouse', 'store'];
    const customAttributes: Record<string, any> = {};
    
    // --- NEW: Price & Value Logic ---
    let unitPrice = 0;
    const priceKeywords = ['unit price', 'unit_price', 'price', 'rate', 'cost', 'mrp', 'unit cost'];

    Object.keys(row).forEach(key => {
        if (!knownKeys.includes(key)) {
            customAttributes[key] = row[key];

            // Check if this key is a price column
            if (priceKeywords.includes(key) && unitPrice === 0) {
                unitPrice = parsePrice(row[key]);
            }
        }
    });

    // If we found a price, calculate System Value and store it
    if (unitPrice > 0) {
        customAttributes['unit_price'] = unitPrice; // Standardize for code usage
        customAttributes['system_value'] = unitPrice * systemQuantity;
        customAttributes['physical_value'] = 0; // Initialize
    }

    return {
      sku,
      name,
      category,
      location: '', 
      systemQuantity,
      physicalQuantity: null,
      status: 'pending' as const,
      lastAudited: null,
      notes: '',
      customAttributes,
    };
  });
};

export const processClosingStockData = (
  rows: CSVRow[],
  userRole: 'admin' | 'auditor',
  selectedLocationId?: string,
  allLocations?: Location[]
): any[] => {
  if (userRole === 'auditor') {
    if (!selectedLocationId || selectedLocationId === 'default') {
      throw new Error("Auditor must select a location.");
    }
    const locationObj = allLocations?.find(loc => loc.id === selectedLocationId);
    if (!locationObj) {
      throw new Error("Selected location is invalid.");
    }
    const auditorLocationName = locationObj.name;

    return rows.map((row, index) => {
      const sku = row['sku'] || row['item code'];
      if (!sku) throw new Error(`Row ${index + 2} is missing 'sku'.`);

      const quantityStr = row['systemquantity'] || row['system quantity'] || row['quantity'] || row['qty'] || '0';
      const systemQuantity = parseInt(quantityStr, 10);
      if (isNaN(systemQuantity)) throw new Error(`Row ${index + 2} has invalid quantity.`);
      
      // Capture extra columns for value calculation if present in stock file
      const customAttributes: Record<string, any> = {};
      let unitPrice = 0;
      const priceKeywords = ['unit price', 'unit_price', 'price', 'rate', 'cost', 'mrp'];
      
      Object.keys(row).forEach(key => {
         if (!['sku', 'item code', 'systemquantity', 'system quantity', 'quantity', 'qty'].includes(key)) {
             customAttributes[key] = row[key];
             if (priceKeywords.includes(key) && unitPrice === 0) {
                 unitPrice = parsePrice(row[key]);
             }
         }
      });

      if (unitPrice > 0) {
         customAttributes['unit_price'] = unitPrice;
         customAttributes['system_value'] = unitPrice * systemQuantity;
      }

      return {
        sku,
        location: auditorLocationName,
        systemQuantity,
        customAttributes // Pass this through
      };
    });
  } else {
    return rows.map((row, index) => {
      const sku = row['sku'] || row['item code'];
      if (!sku) throw new Error(`Row ${index + 2} is missing 'sku'.`);

      const quantityStr = row['systemquantity'] || row['system quantity'] || row['quantity'] || row['qty'] || '0';
      const systemQuantity = parseInt(quantityStr, 10);
      if (isNaN(systemQuantity)) throw new Error(`Row ${index + 2} has invalid quantity.`);

      const rowLocation = row['location'] || row['warehouse'] || row['store'];
      if (!rowLocation) throw new Error(`Admin upload requires 'location' column in row ${index + 2}.`);

      const customAttributes: Record<string, any> = {};
      let unitPrice = 0;
      const priceKeywords = ['unit price', 'unit_price', 'price', 'rate', 'cost', 'mrp'];
      
      Object.keys(row).forEach(key => {
         if (!['sku', 'item code', 'systemquantity', 'system quantity', 'quantity', 'qty', 'location', 'warehouse', 'store'].includes(key)) {
             customAttributes[key] = row[key];
             if (priceKeywords.includes(key) && unitPrice === 0) {
                 unitPrice = parsePrice(row[key]);
             }
         }
      });
      
      if (unitPrice > 0) {
         customAttributes['unit_price'] = unitPrice;
         customAttributes['system_value'] = unitPrice * systemQuantity;
      }

      return {
        sku,
        location: rowLocation,
        systemQuantity,
        customAttributes
      };
    });
  }
};