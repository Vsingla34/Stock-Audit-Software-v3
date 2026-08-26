// src/lib/queryFilter.ts
//
// Build 04 — Natural-language inventory query.
//
// The architectural rule: the model NEVER emits SQL, and NEVER sees a
// connection string. It emits a small JSON object matching this schema,
// which gets validated here (client AND server side) and then translated
// with a parameterised RPC. A malformed or hostile model output fails
// validation instead of executing. RLS still enforces company scoping
// underneath regardless, so even a filter that somehow slipped through
// cannot cross tenants.
//
// .strict() is the load-bearing part — it rejects any key the model
// invents that isn't in this list.

import { z } from "zod";

export const QueryFilterSchema = z.object({
  search:      z.string().max(120).optional(),
  categories:  z.array(z.string().max(80)).max(20).optional(),
  locationId:  z.string().uuid().optional(),
  subLocation: z.string().max(80).optional(),
  status:      z.array(z.enum(['pending', 'matched', 'discrepancy'])).optional(),
  variance: z.object({
    op:     z.enum(['gt', 'lt', 'gte', 'lte', 'between', 'eq']),
    value:  z.number(),
    value2: z.number().optional(),          // only used with 'between'
    unit:   z.enum(['absolute', 'percent', 'value']),
  }).optional(),
  // NEW: a direct quantity question ("physical quantity more than 15")
  // is different from a variance question (the DIFFERENCE between
  // physical and system). Both are common phrasings, so both get a field.
  quantity: z.object({
    field:  z.enum(['physical', 'system']),
    op:     z.enum(['gt', 'lt', 'gte', 'lte', 'between', 'eq']),
    value:  z.number(),
    value2: z.number().optional(),
  }).optional(),
  auditedBy: z.string().uuid().optional(),
  auditedBetween: z.object({
    from: z.string(),
    to:   z.string(),
  }).optional(),
  sort: z.object({
    field: z.enum(['variance', 'value', 'sku', 'name', 'lastAudited', 'physicalQty', 'systemQty']),
    dir:   z.enum(['asc', 'desc']),
  }).optional(),
  // Fix: default was 100, silently truncating "show me all discrepancies"
  // to the first 100 even when hundreds actually matched. Raised to 5000
  // (covers any realistic single-assignment item count) — the model can
  // still set a lower limit explicitly for "top 20" style questions.
  limit: z.number().int().min(1).max(5000).default(5000),
  // Set instead of a filter when the question is unanswerable with what
  // we know — e.g. it names a location that doesn't exist. The UI shows
  // this as a follow-up question rather than guessing.
  clarify: z.string().max(200).optional(),
  // Set when the question has nothing to do with inventory/audits at all —
  // distinct from clarify (relevant-but-ambiguous). Lets the UI say "that's
  // outside what I can help with" instead of forcing a filter interpretation.
  outOfContext: z.boolean().optional(),
}).strict();

export type QueryFilter = z.infer<typeof QueryFilterSchema>;

// ── Human-readable chip labels ──────────────────────────────────────────────
// Used by the palette to render "what the model understood" as removable
// chips, so a subtly wrong interpretation is visible and correctable
// instead of looking identical to a correct one.

export function filterToChips(f: QueryFilter): { key: string; label: string }[] {
  const chips: { key: string; label: string }[] = [];

  if (f.search) chips.push({ key: "search", label: `"${f.search}"` });

  if (f.categories?.length) {
    chips.push({ key: "categories", label: `Category: ${f.categories.join(", ")}` });
  }

  if (f.subLocation) chips.push({ key: "subLocation", label: `Location: ${f.subLocation}` });

  if (f.status?.length) {
    chips.push({ key: "status", label: `Status: ${f.status.join(", ")}` });
  }

  if (f.variance) {
    const unitLabel = f.variance.unit === "percent" ? "%" : f.variance.unit === "value" ? " (value)" : "";
    const opLabel: Record<string, string> = {
      gt: ">", lt: "<", gte: "≥", lte: "≤", eq: "=",
      between: `between ${f.variance.value} and ${f.variance.value2}`,
    };
    const valuePart = f.variance.op === "between"
      ? opLabel.between
      : `${opLabel[f.variance.op]} ${f.variance.value}`;
    chips.push({ key: "variance", label: `Variance ${valuePart}${unitLabel}` });
  }

  if (f.quantity) {
    const opLabel: Record<string, string> = {
      gt: ">", lt: "<", gte: "≥", lte: "≤", eq: "=",
      between: `between ${f.quantity.value} and ${f.quantity.value2}`,
    };
    const valuePart = f.quantity.op === "between"
      ? opLabel.between
      : `${opLabel[f.quantity.op]} ${f.quantity.value}`;
    const fieldLabel = f.quantity.field === "physical" ? "Physical Qty" : "System Qty";
    chips.push({ key: "quantity", label: `${fieldLabel} ${valuePart}` });
  }

  if (f.auditedBetween) {
    chips.push({ key: "auditedBetween", label: `Audited ${f.auditedBetween.from} → ${f.auditedBetween.to}` });
  }

  if (f.sort) {
    chips.push({ key: "sort", label: `Sort: ${f.sort.field} ${f.sort.dir}` });
  }

  return chips;
}

// ── Cache key ──────────────────────────────────────────────────────────────
// Normalise the question so trivial rephrasing/whitespace differences
// still hit the cache — people ask the same dozen questions repeatedly.

export function normaliseQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ").replace(/[?.!]+$/, "");
}