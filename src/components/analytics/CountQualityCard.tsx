// src/components/analytics/CountQualityCard.tsx
//
// Build 05 — displays pre-computed anomaly findings with careful,
// neutral framing. Restricted to admin/super_admin at the call site in
// Analytics.tsx — an auditor should not see peers flagged.

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, ChevronDown, ChevronUp, Info } from "lucide-react";
import SupabaseDataService from "@/services/SupabaseDataService";
import {
  detectAnomalies, AnomalyFinding, SIGNAL_LABELS, SIGNAL_RECOMMENDATION,
} from "@/lib/anomalyDetection";
import { supabase } from "@/integrations/supabase/client";

interface CountQualityCardProps {
  assignmentId: number | null;
  showSystemQuantity: boolean;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-red-200 bg-red-50",
  warning:  "border-amber-200 bg-amber-50",
  info:     "border-blue-200 bg-blue-50",
};

export const CountQualityCard = ({ assignmentId, showSystemQuantity }: CountQualityCardProps) => {
  const [loading, setLoading] = useState(true);
  const [findings, setFindings] = useState<AnomalyFinding[]>([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!assignmentId) { setLoading(false); return; }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await SupabaseDataService.getCountQuality(assignmentId);
        if (cancelled) return;

        const detected = detectAnomalies(rows, { showSystemQuantity });
        setFindings(detected);

        if (detected.length > 0) {
          setExplanationLoading(true);
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            const res = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/explain-anomalies`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  findings: detected.map((f) => ({
                    auditorName: f.auditorName,
                    signal: SIGNAL_LABELS[f.signal],
                    value: f.value,
                    peerMedian: f.peerMedian,
                    description: f.description,
                  })),
                }),
              }
            );
            const body = await res.json();
            if (!cancelled && body.explanation) setExplanation(body.explanation);
          } catch {
            // Prose summary is a nice-to-have — the findings list below
            // is already correct and useful even without it.
          } finally {
            if (!cancelled) setExplanationLoading(false);
          }
        }
      } catch (e) {
        console.error("Failed to load count quality:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [assignmentId, showSystemQuantity]);

  if (!assignmentId) return null;

  // Group findings by auditor for a cleaner card
  const byAuditor = findings.reduce<Record<string, AnomalyFinding[]>>((acc, f) => {
    (acc[f.auditorId] ??= []).push(f);
    return acc;
  }, {});

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-violet-500" />
          Count Quality
        </CardTitle>
        <CardDescription className="text-[12px]">
          Statistical patterns worth a second look — not findings of misconduct.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
          </div>
        ) : findings.length === 0 ? (
          <div className="text-center py-6 text-[13px] text-slate-400">
            No unusual counting patterns detected for this assignment.
          </div>
        ) : (
          <div className="space-y-3">
            {(explanation || explanationLoading) && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                {explanationLoading ? (
                  <span className="text-[12px] text-slate-400 flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Summarizing…
                  </span>
                ) : (
                  <p className="text-[12px] text-slate-600">{explanation}</p>
                )}
              </div>
            )}

            {Object.entries(byAuditor).map(([auditorId, auditorFindings]) => {
              const isOpen = expanded[auditorId] ?? true;
              return (
                <div key={auditorId} className="rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setExpanded((p) => ({ ...p, [auditorId]: !isOpen }))}
                    className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <span className="text-[13px] font-medium text-slate-700">
                      {auditorFindings[0].auditorName}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {auditorFindings.length} pattern{auditorFindings.length !== 1 ? "s" : ""}
                      </Badge>
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="divide-y divide-slate-100">
                      {auditorFindings.map((f, i) => (
                        <div key={i} className={`px-3 py-2.5 ${SEVERITY_STYLES[f.severity]}`}>
                          <p className="text-[12px] font-medium text-slate-700">
                            {SIGNAL_LABELS[f.signal]}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{f.description}</p>
                          <p className="text-[11px] text-slate-400 mt-1 italic">
                            {SIGNAL_RECOMMENDATION[f.signal]}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};