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

/**
 * Process Item Master CSV - Creates BLUEPRINTS with NO location
 * Expected columns: sku, name, category
 * Location will be EMPTY (null or '')
 */
export const processItemMasterData = (rows: CSVRow[]): Omit<InventoryItem, 'id'>[] => {
  return rows.map((row, index) => {
    const sku = row['sku'] || row['item code'];
    if (!sku) {
      throw new Error(`Row ${index + 2} in Item Master is missing 'sku' column.`);
    }

    const name = row['name'] || row['item name'] || row['description'] || 'Unnamed Item';
    const category = row['category'] || row['type'] || '';

    // BLUEPRINT: Location is EMPTY
    return {
      sku,
      name,
      category,
      location: '', // Empty location = Blueprint
      systemQuantity: 0,
      physicalQuantity: null,
      status: 'pending' as const,
      lastAudited: null,
      notes: '',
    };
  });
};

/**
 * Process Closing Stock CSV
 * Returns array of {sku, location, systemQuantity} objects
 */
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

      return {
        sku,
        location: auditorLocationName,
        systemQuantity,
      };
    });
  } else {
    // Admin workflow - requires location in CSV
    return rows.map((row, index) => {
      const sku = row['sku'] || row['item code'];
      if (!sku) throw new Error(`Row ${index + 2} is missing 'sku'.`);

      const quantityStr = row['systemquantity'] || row['system quantity'] || row['quantity'] || row['qty'] || '0';
      const systemQuantity = parseInt(quantityStr, 10);
      if (isNaN(systemQuantity)) throw new Error(`Row ${index + 2} has invalid quantity.`);

      const rowLocation = row['location'] || row['warehouse'] || row['store'];
      if (!rowLocation) throw new Error(`Admin upload requires 'location' column in row ${index + 2}.`);

      return {
        sku,
        location: rowLocation,
        systemQuantity,
      };
    });
  }
};

