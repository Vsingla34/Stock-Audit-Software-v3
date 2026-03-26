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
  // CRITICAL: Track SKUs to detect duplicates
  const seenSkus = new Map<string, number>(); // SKU -> first occurrence row number
  const duplicates: string[] = [];
  
  const processedItems = rows.map((row, index) => {
    const sku = (row['sku'] || row['item code'] || '').trim();
    if (!sku) {
      throw new Error(`Row ${index + 2} in Item Master is missing 'sku' column.`);
    }

    // Check for duplicates
    if (seenSkus.has(sku)) {
      duplicates.push(`SKU "${sku}" appears in row ${seenSkus.get(sku)} and row ${index + 2}`);
    } else {
      seenSkus.set(sku, index + 2);
    }

    const name = (row['name'] || row['item name'] || row['description'] || '').trim();
    if (!name) {
      throw new Error(`Row ${index + 2} in Item Master is missing 'name' column.`);
    }

    const category = (row['category'] || row['type'] || '').trim();
    if (!category) {
      throw new Error(`Row ${index + 2} in Item Master is missing 'category' column.`);
    }
    
    // 🔥 FIX: Changed parseInt to parseFloat to allow decimals
    const quantityStr = row['systemquantity'] || row['system quantity'] || row['quantity'] || row['qty'] || '0';
    const systemQuantity = parseFloat(quantityStr) || 0;

    // RESERVED FIELDS - These are NOT custom attributes
    const reservedKeys = [
      'sku', 'item code', 
      'name', 'item name', 'description', 
      'category', 'type', 
      'systemquantity', 'system quantity', 'quantity', 'qty', 
      'location', 'warehouse', 'store'
    ];
    
    const customAttributes: Record<string, any> = {};
    
    // --- Price & Value Logic ---
    let unitPrice = 0;
    const priceKeywords = ['unit price', 'unit_price', 'price', 'rate', 'cost', 'mrp', 'unit cost'];

    Object.keys(row).forEach(key => {
        // Only add to customAttributes if NOT a reserved field
        if (!reservedKeys.includes(key)) {
            const value = row[key];
            if (value !== null && value !== undefined && value !== '') {
              customAttributes[key] = value;
            }

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

  // CRITICAL: Throw error if duplicates found
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate SKUs found in CSV:\n${duplicates.slice(0, 5).join('\n')}` +
      (duplicates.length > 5 ? `\n...and ${duplicates.length - 5} more duplicates` : '') +
      `\n\nPlease remove duplicate SKUs and try again.`
    );
  }

  return processedItems;
};

export const processClosingStockData = (
  rows: CSVRow[],
  userRole: 'admin' | 'auditor',
  selectedLocationId?: string,
  allLocations?: Location[]
): any[] => {
  // CRITICAL: Track SKUs to detect duplicates
  const seenSkus = new Map<string, number>();
  const duplicates: string[] = [];

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
      const sku = (row['sku'] || row['item code'] || '').trim();
      if (!sku) throw new Error(`Row ${index + 2} is missing 'sku'.`);

      // Check for duplicates
      if (seenSkus.has(sku)) {
        duplicates.push(`SKU "${sku}" appears in row ${seenSkus.get(sku)} and row ${index + 2}`);
      } else {
        seenSkus.set(sku, index + 2);
      }

      // 🔥 FIX: Changed parseInt to parseFloat
      const quantityStr = row['systemquantity'] || row['system quantity'] || row['quantity'] || row['qty'] || '0';
      const systemQuantity = parseFloat(quantityStr);
      if (isNaN(systemQuantity)) throw new Error(`Row ${index + 2} has invalid quantity.`);
      
      // RESERVED FIELDS
      const reservedKeys = ['sku', 'item code', 'name', 'item name', 'description', 'category', 'type', 'systemquantity', 'system quantity', 'quantity', 'qty'];
      
      const customAttributes: Record<string, any> = {};
      let unitPrice = 0;
      const priceKeywords = ['unit price', 'unit_price', 'price', 'rate', 'cost', 'mrp'];
      
      Object.keys(row).forEach(key => {
         if (!reservedKeys.includes(key)) {
             const value = row[key];
             if (value !== null && value !== undefined && value !== '') {
               customAttributes[key] = value;
             }
             
             if (priceKeywords.includes(key) && unitPrice === 0) {
                 unitPrice = parsePrice(row[key]);
             }
         }
      });

      if (unitPrice > 0) {
         customAttributes['unit_price'] = unitPrice;
         customAttributes['system_value'] = unitPrice * systemQuantity;
      }

      // Throw error if duplicates found
      if (duplicates.length > 0) {
        throw new Error(
          `Duplicate SKUs found in Closing Stock CSV:\n${duplicates.slice(0, 5).join('\n')}` +
          (duplicates.length > 5 ? `\n...and ${duplicates.length - 5} more duplicates` : '') +
          `\n\nPlease remove duplicate SKUs and try again.`
        );
      }

      return {
        sku,
        location: auditorLocationName,
        systemQuantity,
        customAttributes
      };
    });
  } else {
    // ADMIN UPLOAD
    return rows.map((row, index) => {
      const sku = (row['sku'] || row['item code'] || '').trim();
      if (!sku) throw new Error(`Row ${index + 2} is missing 'sku'.`);

      // Check for duplicates
      if (seenSkus.has(sku)) {
        duplicates.push(`SKU "${sku}" appears in row ${seenSkus.get(sku)} and row ${index + 2}`);
      } else {
        seenSkus.set(sku, index + 2);
      }

      // 🔥 FIX: Changed parseInt to parseFloat
      const quantityStr = row['systemquantity'] || row['system quantity'] || row['quantity'] || row['qty'] || '0';
      const systemQuantity = parseFloat(quantityStr);
      if (isNaN(systemQuantity)) throw new Error(`Row ${index + 2} has invalid quantity.`);

      const rowLocation = row['location'] || row['warehouse'] || row['store'];
      if (!rowLocation) throw new Error(`Admin upload requires 'location' column in row ${index + 2}.`);

      const reservedKeys = ['sku', 'item code', 'name', 'item name', 'description', 'category', 'type', 'systemquantity', 'system quantity', 'quantity', 'qty', 'location', 'warehouse', 'store'];
      
      const customAttributes: Record<string, any> = {};
      let unitPrice = 0;
      const priceKeywords = ['unit price', 'unit_price', 'price', 'rate', 'cost', 'mrp'];
      
      Object.keys(row).forEach(key => {
         if (!reservedKeys.includes(key)) {
             const value = row[key];
             if (value !== null && value !== undefined && value !== '') {
               customAttributes[key] = value;
             }
             
             if (priceKeywords.includes(key) && unitPrice === 0) {
                 unitPrice = parsePrice(row[key]);
             }
         }
      });
      
      if (unitPrice > 0) {
         customAttributes['unit_price'] = unitPrice;
         customAttributes['system_value'] = unitPrice * systemQuantity;
      }

      // Throw error if duplicates found
      if (duplicates.length > 0) {
        throw new Error(
          `Duplicate SKUs found in Closing Stock CSV:\n${duplicates.slice(0, 5).join('\n')}` +
          (duplicates.length > 5 ? `\n...and ${duplicates.length - 5} more duplicates` : '') +
          `\n\nPlease remove duplicate SKUs and try again.`
        );
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