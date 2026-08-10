import { useState, useMemo, useCallback } from "react";
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
  Download,
} from "lucide-react";
import jsPDF from "jspdf";
import { autoTable } from "jspdf-autotable";

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

// ─── PDF Generator ────────────────────────────────────────────────────────────

function generatePDF(
  report: AIReport,
  companyName: string,
  locationName: string,
  assignmentDate: string,
  summary: SummaryStats
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 0;

  // ── Colour palette ─────────────────────────────────────────────────────────
  const VIOLET  = [109, 40, 217] as [number, number, number];
  const INDIGO  = [67,  56, 202] as [number, number, number];
  const RED     = [220, 38,  38] as [number, number, number];
  const GREEN   = [22, 163,  74] as [number, number, number];
  const AMBER   = [217, 119,  6] as [number, number, number];
  const GRAY    = [107, 114, 128] as [number, number, number];
  const LGRAY   = [243, 244, 246] as [number, number, number];
  const BLACK   = [17,  24,  39] as [number, number, number];
  const WHITE   = [255, 255, 255] as [number, number, number];

  // ── Helper: add new page if needed ────────────────────────────────────────
  const checkPage = (needed = 20) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // ── Header banner ──────────────────────────────────────────────────────────
  doc.setFillColor(...VIOLET);
  doc.rect(0, 0, pageW, 38, "F");

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("AI Audit Report", margin, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${companyName}  ·  ${locationName}  ·  ${assignmentDate}`, margin, 22);
  doc.text(`Generated on ${new Date().toLocaleString()}`, margin, 28);

  // Powered-by badge
  doc.setFillColor(255, 255, 255, 0.2);
  doc.setFontSize(7.5);
  doc.setTextColor(220, 200, 255);
  doc.text("✦  Powered by AI", pageW - margin, 14, { align: "right" });

  y = 46;

  // ── Summary KPI row ────────────────────────────────────────────────────────
  const metrics = report.executiveSummary.keyMetrics;
  const boxW = (contentW - 6) / 4;

  const metricBg: Record<MetricStatus, [number, number, number]> = {
    good:     [220, 252, 231],
    warning:  [254, 243, 199],
    critical: [254, 226, 226],
  };
  const metricFg: Record<MetricStatus, [number, number, number]> = {
    good:     [22,  101,  52],
    warning:  [146, 64,   14],
    critical: [153, 27,   27],
  };

  metrics.forEach((m, i) => {
    const x = margin + i * (boxW + 2);
    const bg = metricBg[m.status] ?? LGRAY;
    const fg = metricFg[m.status] ?? BLACK;
    doc.setFillColor(...bg);
    doc.roundedRect(x, y, boxW, 18, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...fg);
    doc.text(m.value, x + boxW / 2, y + 8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(m.label.toUpperCase(), x + boxW / 2, y + 14, { align: "center" });
  });

  y += 26;

  // ── Section helper ─────────────────────────────────────────────────────────
  const sectionTitle = (
    title: string,
    color: [number, number, number] = INDIGO
  ) => {
    checkPage(16);
    doc.setFillColor(...color);
    doc.rect(margin, y, 3, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...color);
    doc.text(title, margin + 6, y + 5.5);
    y += 11;
    doc.setDrawColor(...color);
    doc.setLineWidth(0.2);
    doc.line(margin, y, margin + contentW, y);
    y += 4;
  };

  const bodyText = (text: string, indent = 0) => {
    checkPage(12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
    const lines = doc.splitTextToSize(text, contentW - indent);
    doc.text(lines, margin + indent, y);
    y += lines.length * 5 + 3;
  };

  const labelText = (label: string, value: string) => {
    checkPage(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(label.toUpperCase(), margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BLACK);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(value, contentW - 30);
    doc.text(lines, margin + 30, y);
    y += lines.length * 5 + 2;
  };

  // ── 1. Executive Summary ───────────────────────────────────────────────────
  sectionTitle("1.  Executive Summary", INDIGO);

  // Headline box
  doc.setFillColor(...LGRAY);
  doc.roundedRect(margin, y, contentW, 10, 2, 2, "F");
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(9.5);
  doc.setTextColor(...INDIGO);
  const headlineLines = doc.splitTextToSize(
    report.executiveSummary.headline,
    contentW - 6
  );
  doc.text(headlineLines, margin + 3, y + 6.5);
  y += 14;

  bodyText(report.executiveSummary.overview);

  // ── 2. Discrepancy Analysis ────────────────────────────────────────────────
  y += 4;
  sectionTitle("2.  Discrepancy & Variance Analysis", RED);
  bodyText(report.discrepancyAnalysis.overview);

  // Pattern pill
  doc.setFillColor(255, 251, 235);
  const patternLines = doc.splitTextToSize(
    `Pattern: ${report.discrepancyAnalysis.pattern}`,
    contentW - 8
  );
  const pillH = patternLines.length * 5 + 6;
  checkPage(pillH + 4);
  doc.roundedRect(margin, y, contentW, pillH, 2, 2, "F");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...AMBER);
  doc.text(patternLines, margin + 4, y + 5);
  y += pillH + 5;

  // Top issues table
  if (report.discrepancyAnalysis.topIssues.length > 0) {
    checkPage(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...RED);
    doc.text("Top Issues", margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["SKU", "Name", "Category", "Variance", "Impact"]],
      body: report.discrepancyAnalysis.topIssues.map((issue) => [
        issue.sku,
        issue.name,
        issue.category,
        issue.variance > 0 ? `+${issue.variance}` : String(issue.variance),
        issue.impact,
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: RED, textColor: WHITE, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 40 },
        2: { cellWidth: 28 },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: "auto" },
      },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === "body") {
          const val = parseFloat(String(data.cell.raw));
          data.cell.styles.textColor =
            val < 0 ? RED : val > 0 ? GREEN : GRAY;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Recommendation box
  checkPage(20);
  doc.setFillColor(239, 246, 255);
  const recLines = doc.splitTextToSize(
    `Recommendation: ${report.discrepancyAnalysis.recommendation}`,
    contentW - 8
  );
  const recH = recLines.length * 5 + 6;
  doc.roundedRect(margin, y, contentW, recH, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(29, 78, 216);
  doc.text(recLines, margin + 4, y + 5);
  y += recH + 8;

  // ── 3. Category Breakdown ──────────────────────────────────────────────────
  checkPage(30);
  sectionTitle("3.  Category Performance Breakdown", [79, 70, 229]);

  const verdictFill: Record<string, [number, number, number]> = {
    Excellent: [220, 252, 231],
    Good:      [219, 234, 254],
    Fair:      [254, 243, 199],
    Poor:      [254, 226, 226],
  };
  const verdictText: Record<string, [number, number, number]> = {
    Excellent: GREEN,
    Good:      INDIGO,
    Fair:      AMBER,
    Poor:      RED,
  };

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Category", "Items", "Match Rate", "Discrepancies", "Verdict", "Insight"]],
    body: report.categoryBreakdown.map((cat) => [
      cat.category,
      String(cat.totalItems),
      `${cat.matchRate}%`,
      String(cat.discrepancies),
      cat.verdict,
      cat.insight,
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: WHITE,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 32 },
      1: { cellWidth: 14, halign: "center" },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 24, halign: "center" },
      4: { cellWidth: 20, halign: "center" },
      5: { cellWidth: "auto" },
    },
    alternateRowStyles: { fillColor: [245, 243, 255] },
    didParseCell: (data) => {
      if (data.column.index === 2 && data.section === "body") {
        const rate = parseFloat(String(data.cell.raw));
        data.cell.styles.textColor =
          rate >= 90 ? GREEN : rate >= 70 ? AMBER : RED;
        data.cell.styles.fontStyle = "bold";
      }
      if (data.column.index === 4 && data.section === "body") {
        const v = String(data.cell.raw) as keyof typeof verdictFill;
        data.cell.styles.fillColor = verdictFill[v] ?? LGRAY;
        data.cell.styles.textColor = verdictText[v] ?? BLACK;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.halign = "center";
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Footer on every page ───────────────────────────────────────────────────
  const totalPages = (doc as any).internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(...LGRAY);
    doc.rect(0, pageH - 12, pageW, 12, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(
      `${companyName}  ·  AI Audit Report  ·  ${assignmentDate}`,
      margin,
      pageH - 5
    );
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 5, {
      align: "right",
    });
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  const safeName = companyName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`AI_Audit_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const AIReportSection = ({
  summary,
  baseTableData,
  companyName,
  locationName,
  assignmentDate,
  uniqueCategories,
}: AIReportSectionProps) => {
  const [report, setReport]     = useState<AIReport | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // ── Build category stats ──────────────────────────────────────────────────
  const categoryStats = useMemo(() => {
    const map = new Map<string, {
      total: number; matched: number; discrepancies: number;
      pending: number; systemQty: number; physicalQty: number;
    }>();
    baseTableData.forEach((item) => {
      const cat = item.category || "Uncategorized";
      if (!map.has(cat)) {
        map.set(cat, { total: 0, matched: 0, discrepancies: 0, pending: 0, systemQty: 0, physicalQty: 0 });
      }
      const s = map.get(cat)!;
      s.total++;
      s.systemQty   += item.systemQuantity   || 0;
      s.physicalQty += item.physicalQuantity || 0;
      if (item.status === "matched")          s.matched++;
      else if (item.status === "discrepancy") s.discrepancies++;
      else                                     s.pending++;
    });
    return Array.from(map.entries()).map(([category, s]) => ({
      category,
      total:            s.total,
      matched:          s.matched,
      discrepancies:    s.discrepancies,
      pending:          s.pending,
      matchRate:        s.total > 0 ? Math.round((s.matched / s.total) * 100) : 0,
      totalSystemQty:   s.systemQty,
      totalPhysicalQty: s.physicalQty,
      totalVariance:    s.physicalQty - s.systemQty,
    }));
  }, [baseTableData]);

  // ── Build top discrepancies ───────────────────────────────────────────────
  const topDiscrepancies = useMemo(() =>
    [...baseTableData]
      .filter((i) => i.status === "discrepancy")
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
      .slice(0, 10)
      .map((i) => ({
        sku:         i.sku,
        name:        i.name        || "Unknown",
        category:    i.category    || "Uncategorized",
        systemQty:   i.systemQuantity,
        physicalQty: i.physicalQuantity,
        variance:    i.variance,
      })),
    [baseTableData]
  );

  // ── Generate AI report ────────────────────────────────────────────────────
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

  // ── Download PDF ──────────────────────────────────────────────────────────
  const handleDownloadPDF = useCallback(() => {
    if (!report) return;
    setDownloading(true);
    try {
      generatePDF(report, companyName, locationName, assignmentDate, summary);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setDownloading(false);
    }
  }, [report, companyName, locationName, assignmentDate, summary]);

  const hasData = summary.totalItems > 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Trigger card */}
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-gray-900 text-base">AI Audit Report</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  Executive summary · Discrepancy analysis · Category breakdown
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Download PDF button — only shown when report is ready */}
              {report && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                  className="h-8 gap-1.5 border-violet-300 text-violet-700 hover:bg-violet-50"
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download PDF
                </Button>
              )}

              {report && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-violet-700 h-8 gap-1"
                  onClick={() => setExpanded((p) => !p)}
                >
                  {expanded
                    ? <><ChevronUp className="h-4 w-4" /> Hide</>
                    : <><ChevronDown className="h-4 w-4" /> Show</>}
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

        {loading && (
          <CardContent>
            <div className="space-y-3 animate-pulse">
              {[80, 60, 90, 50].map((w, i) => (
                <div key={i} className="h-3 bg-violet-100 rounded" style={{ width: `${w}%` }} />
              ))}
            </div>
            <p className="text-xs text-violet-500 mt-4 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Analysing your audit data…
            </p>
          </CardContent>
        )}

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

        {!hasData && !loading && (
          <CardContent>
            <p className="text-sm text-gray-400 italic">
              No audit data loaded yet. Select an assignment first.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Report output */}
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
              <p className="text-lg font-semibold text-gray-900">
                {report.executiveSummary.headline}
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                {report.executiveSummary.overview}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {report.executiveSummary.keyMetrics.map((m, i) => (
                  <div key={i} className={`rounded-lg border px-3 py-2.5 text-center ${statusColor[m.status]}`}>
                    <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{m.label}</p>
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
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
                <TrendingDown className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="text-xs text-amber-800 font-medium">
                  {report.discrepancyAnalysis.pattern}
                </span>
              </div>

              {report.discrepancyAnalysis.topIssues.length > 0 && (
                <div className="rounded-lg border border-red-100 overflow-hidden">
                  <div className="bg-red-50 px-4 py-2 border-b border-red-100">
                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Top Issues</p>
                  </div>
                  <div className="divide-y divide-red-50">
                    {report.discrepancyAnalysis.topIssues.map((issue, i) => (
                      <div key={i} className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-red-50/40 transition-colors">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-semibold text-gray-800">{issue.sku}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{issue.category}</Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{issue.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 italic">{issue.impact}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-sm font-bold ${issue.variance < 0 ? "text-red-600" : "text-green-600"}`}>
                            <VarianceIcon v={issue.variance} />
                            {issue.variance > 0 ? "+" : ""}{issue.variance}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Category Performance Breakdown
                </CardTitle>
                {/* Second download button inside the report for easy access */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                  className="h-7 gap-1.5 text-xs border-violet-300 text-violet-700 hover:bg-violet-50"
                >
                  {downloading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5" />}
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-gray-100">
                {report.categoryBreakdown.map((cat, i) => (
                  <div key={i} className="py-3 flex items-center gap-4 flex-wrap">
                    <div className="w-36 shrink-0">
                      <p className="text-sm font-medium text-gray-800 truncate" title={cat.category}>
                        {cat.category}
                      </p>
                      <p className="text-xs text-gray-400">{cat.totalItems} items</p>
                    </div>
                    <div className="flex-1 min-w-[100px]">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(cat.matchRate, 100)}%`,
                            backgroundColor:
                              cat.matchRate >= 90 ? "#22c55e"
                              : cat.matchRate >= 70 ? "#f59e0b"
                              : "#ef4444",
                          }}
                        />
                      </div>
                    </div>
                    <div className="w-12 text-right shrink-0">
                      <span className={`text-sm font-bold ${cat.matchRate >= 90 ? "text-green-600" : cat.matchRate >= 70 ? "text-amber-600" : "text-red-600"}`}>
                        {cat.matchRate}%
                      </span>
                    </div>
                    <div className="shrink-0">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${verdictColor[cat.verdict] || "text-gray-600 bg-gray-50 border-gray-200"}`}>
                        {cat.verdict}
                      </span>
                    </div>
                    <div className="w-full pl-0 sm:pl-40">
                      <p className="text-xs text-gray-500 italic">{cat.insight}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-violet-400" />
                <p className="text-xs text-gray-400">
                  Generated by Groq AI · Based on {summary.auditedItems} of {summary.totalItems} audited items
                </p>
              </div>
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
};