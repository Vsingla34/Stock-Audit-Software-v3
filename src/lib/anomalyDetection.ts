// src/lib/anomalyDetection.ts
//
// Build 05 — Count Anomaly Detection.
//
// Every threshold below is a named, inspectable constant — not a magic
// number buried in a formula. If someone asks "why was this flagged?",
// the answer is always a specific line in this file, never "the AI said
// so." The model (in the explain-anomalies edge function) only writes
// prose about numbers computed here; it never decides what counts as
// anomalous.
//
// No absolute baseline exists yet — that needs history from several
// completed audits. Until then, every signal compares an auditor against
// this job's OWN median (peer comparison), not a fixed external number.
// A threshold tuned on one warehouse would misfire on the next.

import type { CountQualityRow } from "@/services/SupabaseDataService";

export const ANOMALY_THRESHOLDS = {
  // Physically implausible counting pace, sustained over a meaningful window.
  VELOCITY_ITEMS_PER_MIN: 20,
  VELOCITY_MIN_ACTIVE_MINUTES: 10,

  // Estimating rather than counting — quantities suspiciously often
  // divisible by 5 (10, 15, 20, 25...) rather than the messier numbers a
  // real count usually produces.
  ROUND_NUMBER_SHARE: 0.6,

  // Copying the displayed system figure instead of counting. ONLY
  // meaningful when the auditor could actually see the system quantity —
  // gated by assignment.showSystemQuantity at call time.
  EXACT_MATCH_SHARE: 0.85,

  // Rushing to finish near a deadline, rather than steady counting
  // throughout the shift.
  FINAL_HOUR_SHARE: 0.4,

  // Peer deviation multiplier — how far from the job's own median counts
  // as worth flagging, applied to each signal above.
  PEER_DEVIATION_MULTIPLIER: 1.5,
} as const;

export type AnomalySeverity = "critical" | "warning" | "info";

export interface AnomalyFinding {
  auditorId: string;
  auditorName: string;
  signal:
    | "velocity"
    | "round_number_bias"
    | "exact_match_rate"
    | "final_hour_burst";
  severity: AnomalySeverity;
  value: number;
  peerMedian: number;
  threshold: number;
  description: string;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Runs every signal against every auditor in one job, comparing each to
 * that job's own peer median rather than an absolute constant. Returns
 * only the findings that actually cross a threshold — silence for
 * everyone else, by design (this is not a report card, it's an exception list).
 */
export function detectAnomalies(
  rows: CountQualityRow[],
  options: { showSystemQuantity: boolean }
): AnomalyFinding[] {
  const findings: AnomalyFinding[] = [];
  if (rows.length < 2) return findings; // no peer group to compare against

  const velocities   = rows.map((r) => r.entries_per_minute);
  const roundShares   = rows.map((r) => r.round_share);
  const exactShares   = rows.map((r) => r.exact_match_share);
  const finalHourShares = rows.map((r) => r.final_hour_share);

  const velocityMedian   = median(velocities);
  const roundMedian      = median(roundShares);
  const exactMedian      = median(exactShares);
  const finalHourMedian  = median(finalHourShares);

  for (const row of rows) {
    // ── Velocity ──────────────────────────────────────────────────────
    if (
      row.active_minutes >= ANOMALY_THRESHOLDS.VELOCITY_MIN_ACTIVE_MINUTES &&
      row.entries_per_minute >= ANOMALY_THRESHOLDS.VELOCITY_ITEMS_PER_MIN &&
      row.entries_per_minute >= velocityMedian * ANOMALY_THRESHOLDS.PEER_DEVIATION_MULTIPLIER
    ) {
      findings.push({
        auditorId: row.auditor_id,
        auditorName: row.auditor_name,
        signal: "velocity",
        severity: "warning",
        value: row.entries_per_minute,
        peerMedian: velocityMedian,
        threshold: ANOMALY_THRESHOLDS.VELOCITY_ITEMS_PER_MIN,
        description: `${row.entries_per_minute} items/min sustained over ${row.active_minutes} min — peer median is ${velocityMedian}/min.`,
      });
    }

    // ── Round-number bias ─────────────────────────────────────────────
    if (
      row.round_share >= ANOMALY_THRESHOLDS.ROUND_NUMBER_SHARE &&
      row.round_share >= roundMedian * ANOMALY_THRESHOLDS.PEER_DEVIATION_MULTIPLIER
    ) {
      findings.push({
        auditorId: row.auditor_id,
        auditorName: row.auditor_name,
        signal: "round_number_bias",
        severity: "info",
        value: row.round_share,
        peerMedian: roundMedian,
        threshold: ANOMALY_THRESHOLDS.ROUND_NUMBER_SHARE,
        description: `${Math.round(row.round_share * 100)}% of quantities are round (÷5) — peer median is ${Math.round(roundMedian * 100)}%.`,
      });
    }

    // ── Exact-match rate — gated on showSystemQuantity ────────────────
    if (
      options.showSystemQuantity &&
      row.exact_match_share >= ANOMALY_THRESHOLDS.EXACT_MATCH_SHARE &&
      row.exact_match_share >= exactMedian * ANOMALY_THRESHOLDS.PEER_DEVIATION_MULTIPLIER
    ) {
      findings.push({
        auditorId: row.auditor_id,
        auditorName: row.auditor_name,
        signal: "exact_match_rate",
        severity: "warning",
        value: row.exact_match_share,
        peerMedian: exactMedian,
        threshold: ANOMALY_THRESHOLDS.EXACT_MATCH_SHARE,
        description: `${Math.round(row.exact_match_share * 100)}% of counts exactly match the system figure — peer median is ${Math.round(exactMedian * 100)}%.`,
      });
    }

    // ── Final-hour burst ───────────────────────────────────────────────
    if (
      row.final_hour_share >= ANOMALY_THRESHOLDS.FINAL_HOUR_SHARE &&
      row.final_hour_share >= finalHourMedian * ANOMALY_THRESHOLDS.PEER_DEVIATION_MULTIPLIER
    ) {
      findings.push({
        auditorId: row.auditor_id,
        auditorName: row.auditor_name,
        signal: "final_hour_burst",
        severity: "info",
        value: row.final_hour_share,
        peerMedian: finalHourMedian,
        threshold: ANOMALY_THRESHOLDS.FINAL_HOUR_SHARE,
        description: `${Math.round(row.final_hour_share * 100)}% of this auditor's entries landed in the final hour — peer median is ${Math.round(finalHourMedian * 100)}%.`,
      });
    }
  }

  return findings;
}

// ── Human-facing labels — deliberately neutral, never accusatory ───────────
// "Recount recommended" / "Unusual pattern — review", never "fraud",
// "cheating", "dishonest". These are statistical indicators, not findings
// of misconduct — the framing has real legal and practical weight.

export const SIGNAL_LABELS: Record<AnomalyFinding["signal"], string> = {
  velocity: "Unusually fast counting pace",
  round_number_bias: "Round-number pattern",
  exact_match_rate: "High match with system figures",
  final_hour_burst: "Concentrated in final hour",
};

export const SIGNAL_RECOMMENDATION: Record<AnomalyFinding["signal"], string> = {
  velocity: "Recount recommended for a sample of this auditor's items.",
  round_number_bias: "Consider a spot recount to confirm precision.",
  exact_match_rate: "Review whether this reflects genuine accuracy or a blind-count violation.",
  final_hour_burst: "Consider whether time pressure affected count quality.",
};