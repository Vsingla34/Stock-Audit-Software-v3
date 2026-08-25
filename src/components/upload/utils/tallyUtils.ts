// src/components/upload/utils/tallyUtils.ts
// Build 02 Phase A — Tally XML import.
//
// Mirrors the signature of processClosingStockData in csvUtils.ts so it
// drops into the existing upload pipeline unchanged. Handles Tally's
// quirky quantity formats, encoding issues, and unescaped XML entities
// that a naive parser would choke on.
//
// npm install fast-xml-parser

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

  // Merge duplicate SKUs — this app keys inventory_items uniquely on
  // (company_id, assignment_id, sku), so if "Show Godown-wise details"
  // produced the same item split across multiple godowns, the raw items
  // above would silently overwrite each other on upsert. Sum quantities
  // instead and flag it, so nothing is lost without the user knowing.
  const bySku = new Map<string, TallyParsedItem>();
  const mergedSkus = new Set<string>();

  for (const item of items) {
    const existing = bySku.get(item.sku);
    if (existing) {
      mergedSkus.add(item.sku);
      existing.systemQuantity += item.systemQuantity;
      // Keep the first godown as the "primary" location for this SKU —
      // splitting one SKU across multiple locations within a single
      // assignment isn't representable in the current schema.
    } else {
      bySku.set(item.sku, { ...item });
    }
  }

  if (mergedSkus.size > 0) {
    const examples = Array.from(mergedSkus).slice(0, 5).join(", ");
    warnings.push(
      `${mergedSkus.size} item(s) appeared in multiple godowns and were ` +
      `merged (quantities summed): ${examples}${mergedSkus.size > 5 ? "…" : ""}. ` +
      `Only the first godown was kept as the item's location.`
    );
  }

  // Clamp negative NET quantities to 0. Tally can legitimately report a
  // negative closing balance (over-sold stock, in-transit adjustments),
  // but inventory_items.system_quantity has a database-level non-negative
  // constraint (Phase 2 data integrity). Since this runs as one bulk
  // INSERT, a single negative row would fail the ENTIRE batch — clamp and
  // warn here instead, so a data-quality issue in Tally doesn't block
  // every other item from importing. This runs AFTER the godown merge
  // above, so a -3 at one godown + 5 at another (net +2) is correctly
  // left alone — only a genuinely negative final total gets clamped.
  const negativeSkus: string[] = [];
  bySku.forEach((item) => {
    if (item.systemQuantity < 0) {
      negativeSkus.push(`${item.sku} (${item.systemQuantity})`);
      item.systemQuantity = 0;
    }
  });

  if (negativeSkus.length > 0) {
    const examples = negativeSkus.slice(0, 5).join(", ");
    warnings.push(
      `${negativeSkus.length} item(s) had a negative closing balance in Tally and were ` +
      `set to 0 (your database doesn't allow negative stock): ${examples}` +
      `${negativeSkus.length > 5 ? "…" : ""}. Verify these in Tally — a negative balance ` +
      `usually means a data entry issue upstream.`
    );
  }

  return {
    items: Array.from(bySku.values()),
    godowns: Array.from(godownSet).sort(),
    warnings,
  };
}