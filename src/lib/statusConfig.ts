// src/lib/statusConfig.ts
// Single source of truth for item status colours, labels and chart colours.
// Import this anywhere you need a consistent status representation.

export type ItemStatus = "matched" | "discrepancy" | "pending";

interface StatusConfig {
  label: string;
  badgeBg: string;       // Tailwind background
  badgeText: string;     // Tailwind text colour
  badgeBorder: string;   // Tailwind border
  dotColor: string;      // Tailwind dot colour
  chartColor: string;    // Hex for recharts
  lightBg: string;       // Light background for cards
}

export const STATUS_CONFIG: Record<ItemStatus, StatusConfig> = {
  matched: {
    label:       "Matched",
    badgeBg:     "bg-green-100",
    badgeText:   "text-green-800",
    badgeBorder: "border-green-200",
    dotColor:    "bg-green-500",
    chartColor:  "#22c55e",
    lightBg:     "bg-green-50",
  },
  discrepancy: {
    label:       "Discrepancy",
    badgeBg:     "bg-red-100",
    badgeText:   "text-red-800",
    badgeBorder: "border-red-200",
    dotColor:    "bg-red-500",
    chartColor:  "#ef4444",
    lightBg:     "bg-red-50",
  },
  pending: {
    label:       "Pending",
    badgeBg:     "bg-amber-100",
    badgeText:   "text-amber-800",
    badgeBorder: "border-amber-200",
    dotColor:    "bg-amber-400",
    chartColor:  "#f59e0b",
    lightBg:     "bg-amber-50",
  },
};

/** Returns Tailwind badge classes for an item status */
export function getStatusBadge(status: string | undefined) {
  const cfg = STATUS_CONFIG[status as ItemStatus] ?? STATUS_CONFIG.pending;
  return `${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder} border text-xs font-medium px-2.5 py-0.5 rounded-full`;
}

/** Returns the hex colour for recharts / SVG */
export function getStatusColor(status: string | undefined): string {
  return STATUS_CONFIG[status as ItemStatus]?.chartColor ?? "#f59e0b";
}

/** Returns the human-readable label */
export function getStatusLabel(status: string | undefined): string {
  return STATUS_CONFIG[status as ItemStatus]?.label ?? "Pending";
}