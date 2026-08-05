import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Minus,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItemRow {
  sku: string;
  name?: string;
  category?: string;
  systemQuantity: number;
  physicalQuantity: number;
  variance: number;
  status: string;
}

interface SummaryStats {
  totalItems: number;
  auditedItems: number;
  matched: number;
  discrepancies: number;
  pendingItems: number;
  totalSystemQty: number;
  totalPhysicalQty: number;
}

interface AIReportSectionProps {
  summary: SummaryStats;
  baseTableData: ItemRow[];
  companyName: string;
  locationName: string;
  assignmentDate: string;
  uniqueCategories: string[];
}

type MetricStatus = "good" | "warning" | "critical";

interface KeyMetric {
  label: string;
  value: string;
  status: MetricStatus;
}

interface AIReport {
  executiveSummary: {
    headline: string;
    overview: string;
    keyMetrics: KeyMetric[];
  };
  discrepancyAnalysis: {
    overview: string;
    pattern: string;
    topIssues: {
      sku: string;
      name: string;
      category: string;
      variance: number;
      impact: string;
    }[];
    recommendation: string;
  };
  categoryBreakdown: {
    category: string;
    matchRate: number;
    totalItems: number;
    discrepancies: number;
    verdict: "Excellent" | "Good" | "Fair" | "Poor";
    insight: string;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusColor: Record<MetricStatus, string> = {
  good:     "bg-green-100 text-green-800 border-green-200",
  warning:  "bg-amber-100 text-amber-800 border-amber-200",
  critical: "bg-red-100 text-red-800 border-red-200",
};

const verdictColor: Record<string, string> = {
  Excellent: "text-green-600 bg-green-50 border-green-200",
  Good:      "text-blue-600 bg-blue-50 border-blue-200",
  Fair:      "text-amber-600 bg-amber-50 border-amber-200",
  Poor:      "text-red-600 bg-red-50 border-red-200",
};

const VarianceIcon = ({ v }: { v: number }) =>
  v < 0 ? (
    <TrendingDown className="h-3.5 w-3.5 text-red-500 inline mr-1" />
  ) : v > 0 ? (
    <TrendingUp className="h-3.5 w-3.5 text-green-500 inline mr-1" />
  ) : (
    <Minus className="h-3.5 w-3.5 text-gray-400 inline mr-1" />
  );

// ─── Main Component ───────────────────────────────────────────────────────────

export const AIReportSection = ({
  summary,
  baseTableData,
  companyName,
  locationName,
  assignmentDate,
  uniqueCategories,
}: AIReportSectionProps) => {
  const [report, setReport]       = useState<AIReport | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [expanded, setExpanded]   = useState(true);

  // ── Build category stats from raw table data ──────────────────────────────
  const categoryStats = useMemo(() => {
    const map = new Map<string, {
      total: number; matched: number; discrepancies: number;
      pending: number; systemQty: number; physicalQty: number;
    }>();

    baseTableData.forEach((item) => {
      const cat = item.category || "Uncategorized";
      if (!map.has(cat)) {
        map.set(cat, {
          total: 0, matched: 0, discrepancies: 0,
          pending: 0, systemQty: 0, physicalQty: 0,
        });
      }
      const s = map.get(cat)!;
      s.total++;
      s.systemQty  += item.systemQuantity  || 0;
      s.physicalQty += item.physicalQuantity || 0;

      if (item.status === "matched")      s.matched++;
      else if (item.status === "discrepancy") s.discrepancies++;
      else                                     s.pending++;
    });

    return Array.from(map.entries()).map(([category, s]) => ({
      category,
      total:          s.total,
      matched:        s.matched,
      discrepancies:  s.discrepancies,
      pending:        s.pending,
      matchRate:      s.total > 0 ? Math.round((s.matched / s.total) * 100) : 0,
      totalSystemQty:   s.systemQty,
      totalPhysicalQty: s.physicalQty,
      totalVariance:    s.physicalQty - s.systemQty,
    }));
  }, [baseTableData]);

  // ── Build top discrepancies (worst 10 by abs variance) ───────────────────
  const topDiscrepancies = useMemo(() =>
    [...baseTableData]
      .filter((i) => i.status === "discrepancy")
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 10)
      .map((i) => ({
        sku:        i.sku,
        name:       i.name       || "Unknown",
        category:   i.category   || "Uncategorized",
        systemQty:  i.systemQuantity,
        physicalQty: i.physicalQuantity,
        variance:   i.variance,
      })),
    [baseTableData]
  );

  // ── Call edge function ────────────────────────────────────────────────────
  const generateReport = async () => {
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "generate-audit-report",
        {
          body: {
            companyName,
            locationName,
            assignmentDate,
            summary,
            categoryStats,
            topDiscrepancies,
          },
        }
      );

      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || "Unknown error from AI");

      setReport(data.report as AIReport);
      setExpanded(true);
    } catch (err: any) {
      console.error("[AIReportSection]", err);
      setError(err.message || "Failed to generate AI report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Empty state guard ────────────────────────────────────────────────────
  const hasData = summary.totalItems > 0;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Trigger Card */}
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-gray-900 text-base">
                  AI Audit Report
                </CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  Executive summary · Discrepancy analysis · Category breakdown
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {report && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-violet-700 h-8 gap-1"
                  onClick={() => setExpanded((p) => !p)}
                >
                  {expanded ? (
                    <><ChevronUp className="h-4 w-4" /> Hide</>
                  ) : (
                    <><ChevronDown className="h-4 w-4" /> Show</>
                  )}
                </Button>
              )}
              <Button
                onClick={generateReport}
                disabled={loading || !hasData}
                className="bg-violet-600 hover:bg-violet-700 text-white gap-2 shadow-sm"
                size="sm"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Analysing…</>
                ) : report ? (
                  <><RefreshCw className="h-4 w-4" /> Regenerate</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate AI Report</>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Loading skeleton */}
        {loading && (
          <CardContent>
            <div className="space-y-3 animate-pulse">
              {[80, 60, 90, 50].map((w, i) => (
                <div key={i} className={`h-3 bg-violet-100 rounded`} style={{ width: `${w}%` }} />
              ))}
            </div>
            <p className="text-xs text-violet-500 mt-4 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Claude is analysing your audit data…
            </p>
          </CardContent>
        )}

        {/* Error */}
        {error && !loading && (
          <CardContent>
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">Generation failed</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          </CardContent>
        )}

        {/* No data guard */}
        {!hasData && !loading && (
          <CardContent>
            <p className="text-sm text-gray-400 italic">
              No audit data loaded yet. Select an assignment first.
            </p>
          </CardContent>
        )}
      </Card>

      {/* ── Report Output ─────────────────────────────────────────────────── */}
      {report && expanded && (
        <div className="space-y-4">

          {/* 1. Executive Summary */}
          <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-indigo-700 uppercase tracking-wide flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Headline */}
              <p className="text-lg font-semibold text-gray-900">
                {report.executiveSummary.headline}
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                {report.executiveSummary.overview}
              </p>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {report.executiveSummary.keyMetrics.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border px-3 py-2.5 text-center ${statusColor[m.status]}`}
                  >
                    <p className="text-xs font-medium opacity-70 uppercase tracking-wide">
                      {m.label}
                    </p>
                    <p className="text-xl font-bold mt-0.5">{m.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 2. Discrepancy Analysis */}
          <Card className="border-red-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-red-700 uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Discrepancy & Variance Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                {report.discrepancyAnalysis.overview}
              </p>

              {/* Pattern pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
                <TrendingDown className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="text-xs text-amber-800 font-medium">
                  {report.discrepancyAnalysis.pattern}
                </span>
              </div>

              {/* Top Issues Table */}
              {report.discrepancyAnalysis.topIssues.length > 0 && (
                <div className="rounded-lg border border-red-100 overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 border-b border-red-100">
                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                      Top Issues
                    </p>
                  </div>
                  <div className="divide-y divide-red-50">
                    {report.discrepancyAnalysis.topIssues.map((issue, i) => (
                      <div key={i} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-red-50/40 transition-colors">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-semibold text-gray-800">
                              {issue.sku}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {issue.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{issue.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 italic">{issue.impact}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`text-sm font-bold ${
                              issue.variance < 0 ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            <VarianceIcon v={issue.variance} />
                            {issue.variance > 0 ? "+" : ""}
                            {issue.variance}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendation */}
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <Sparkles className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Recommendation: </span>
                  {report.discrepancyAnalysis.recommendation}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 3. Category Breakdown */}
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Category Performance Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-gray-100">
                {report.categoryBreakdown.map((cat, i) => (
                  <div key={i} className="py-3 flex items-center gap-4 flex-wrap">
                    {/* Category name */}
                    <div className="w-36 shrink-0">
                      <p className="text-sm font-medium text-gray-800 truncate" title={cat.category}>
                        {cat.category}
                      </p>
                      <p className="text-xs text-gray-400">{cat.totalItems} items</p>
                    </div>

                    {/* Progress bar */}
                    <div className="flex-1 min-w-[100px]">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(cat.matchRate, 100)}%`,
                            backgroundColor:
                              cat.matchRate >= 90
                                ? "#22c55e"
                                : cat.matchRate >= 70
                                ? "#f59e0b"
                                : "#ef4444",
                          }}
                        />
                      </div>
                    </div>

                    {/* Match rate */}
                    <div className="w-12 text-right shrink-0">
                      <span
                        className={`text-sm font-bold ${
                          cat.matchRate >= 90
                            ? "text-green-600"
                            : cat.matchRate >= 70
                            ? "text-amber-600"
                            : "text-red-600"
                        }`}
                      >
                        {cat.matchRate}%
                      </span>
                    </div>

                    {/* Verdict badge */}
                    <div className="shrink-0">
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                          verdictColor[cat.verdict] || "text-gray-600 bg-gray-50 border-gray-200"
                        }`}
                      >
                        {cat.verdict}
                      </span>
                    </div>

                    {/* Insight */}
                    <div className="w-full pl-0 sm:pl-40">
                      <p className="text-xs text-gray-500 italic">{cat.insight}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer note */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-violet-400" />
                <p className="text-xs text-gray-400">
                  Generated by Claude AI · Based on {summary.auditedItems} of {summary.totalItems} audited items
                </p>
              </div>
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
};