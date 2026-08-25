

import { XMLParser } from "fast-xml-parser";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TallyParsedItem {
  sku: string;
  name: string;
  category: string;
  location: string;           // Tally godown name — needs mapping before use
  systemQuantity: number;
  customAttributes: {
    unit_price?: number;
    system_value?: number;
    uom?: string;
  };
}   

export interface TallyParseResult {
  items: TallyParsedItem[];
  godowns: string[];          // distinct godown names found, for the mapping step
  warnings: string[];         // rows skipped or partially parsed
}

// ── Quantity parsing ──────────────────────────────────────────────────────
// Tally quantities arrive as display strings, not numbers:
//   "120.000 Nos"
//   "2 Box of 12 Nos = 24.000 Nos"   ← compound unit, base total after "="
//   "(-)15.000 Kg"                   ← negative, Tally's own notation

export const parseTallyQty = (raw: string | undefined | null): number => {
  if (!raw) return 0;
  const s = String(raw).trim();
  if (!s) return 0;

  // Compound units: the figure after "=" is the base-unit total.
  const compound = s.split("=").pop() ?? s;

  const negative = /^\(-\)|^-/.test(s);
  const digits = compound.replace(/[^0-9.]/g, "");
  const n = parseFloat(digits);

  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
};

// Strips a trailing unit suffix from a rate string, e.g. "450.00/Nos" -> 450.00
export const parseTallyRate = (raw: string | undefined | null): number | undefined => {
  if (!raw) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  const beforeSlash = s.split("/")[0];
  const digits = beforeSlash.replace(/[^0-9.-]/g, "");
  const n = parseFloat(digits);
  return Number.isFinite(n) ? n : undefined;
};

// ── XML sanitisation ───────────────────────────────────────────────────────
// Tally emits raw control characters and bare ampersands that break most
// XML parsers. Run this on the raw file text BEFORE passing to XMLParser.

export const sanitiseTallyXml = (raw: string): string =>
  raw
    // Tally emits raw control chars occasionally
    .replace(/&#[0-4];/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    // Bare ampersands in item names, e.g. "M&S Cotton"
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+);)/g, "&amp;");

// ── Read the file with the right encoding ───────────────────────────────────
// Tally exports in a Windows-1252-flavoured encoding declared as UTF-8.
// Reading as plain UTF-8 corrupts the rupee sign and accented characters.

export const readTallyFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(sanitiseTallyXml(reader.result as string));
    reader.onerror = () => reject(new Error("Could not read the Tally export file."));
    // windows-1252, not utf-8 — Tally lies about its own encoding
    reader.readAsText(file, "windows-1252");
  });

// ── Main parser ────────────────────────────────────────────────────────────
// Expects the XML produced by: Tally Prime → Gateway → Display More Reports
// → Inventory Books → Stock Summary → Ctrl+E → Format: XML
// (with "Show Godown-wise details" set to Yes for location-level data)

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

export function parseTallyStockSummary(xmlText: string): TallyParseResult {
  const warnings: string[] = [];
  const godownSet = new Set<string>();
  const items: TallyParsedItem[] = [];

  let doc: any;
  try {
    doc = parser.parse(xmlText);
  } catch (e: any) {
    throw new Error(
      `Could not parse the Tally XML file. Make sure it was exported with Format: XML. (${e.message})`
    );
  }

  // Tally's export shape varies by version — try the common paths.
  const collection =
    doc?.ENVELOPE?.BODY?.DATA?.COLLECTION ??
    doc?.ENVELOPE?.STOCKSUMMARY?.COLLECTION ??
    doc?.ENVELOPE?.BODY?.EXPORTDATA?.REQUESTDATA?.TALLYMESSAGE;

  if (!collection) {
    throw new Error(
      "This doesn't look like a Tally Stock Summary export. Re-export via " +
      "Gateway → Display More Reports → Inventory Books → Stock Summary → Ctrl+E → Format: XML."
    );
  }

  // STOCKITEM nodes may be a single object or an array depending on count
  const rawItems = Array.isArray(collection.STOCKITEM)
    ? collection.STOCKITEM
    : collection.STOCKITEM
    ? [collection.STOCKITEM]
    : Array.isArray(collection)
    ? collection
    : [];

  for (const raw of rawItems) {
    const name = raw?.["@_NAME"] ?? raw?.NAME;
    if (!name) {
      warnings.push("Skipped a row with no stock item name.");
      continue;
    }

    const category = raw?.PARENT ?? "Uncategorised";
    const godown = raw?.GODOWNNAME ?? raw?.["@_GODOWN"] ?? "Unassigned Godown";
    const closingBalance = parseTallyQty(raw?.CLOSINGBALANCE);
    const closingRate = parseTallyRate(raw?.CLOSINGRATE);
    const closingValue = parseTallyQty(raw?.CLOSINGVALUE);
    const uom = raw?.BASEUNITS;

    godownSet.add(godown);

    items.push({
      sku: String(name),      // Tally has no separate SKU — item name is the key
      name: String(name),
      category: String(category),
      location: String(godown),
      systemQuantity: closingBalance,
      customAttributes: {
        ...(closingRate !== undefined ? { unit_price: closingRate } : {}),
        ...(closingValue ? { system_value: closingValue } : {}),
        ...(uom ? { uom: String(uom) } : {}),
      },
    });
  }

  if (items.length === 0) {
    warnings.push("No stock items were found in this file.");
  }

  return {
    items,
    godowns: Array.from(godownSet).sort(),
    warnings,
  };
}