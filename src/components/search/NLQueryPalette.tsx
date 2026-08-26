// src/components/search/NLQueryPalette.tsx
//
// Build 04 — Cmd+K natural-language inventory query.
//
// Flow: type a question -> edge function returns JSON -> validated against
// QueryFilterSchema client-side -> translated to query_inventory_by_filter
// RPC -> results render as chips (what the model understood) + a list.
// Removing a chip re-runs the RPC directly with the mutated filter — no
// new model call needed, since we already have a validated structured
// filter at that point.

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Search as SearchIcon, X, Loader2, AlertCircle, HelpCircle, Ban,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStatusBadge } from "@/lib/statusConfig";
import SupabaseDataService from "@/services/SupabaseDataService";
import {
  QueryFilterSchema, QueryFilter, filterToChips, normaliseQuery,
} from "@/lib/queryFilter";
import type { InventoryItem } from "@/context/InventoryContext";

// In-memory cache — the same dozen questions get asked repeatedly.
// Cleared on page refresh; not worth persisting across sessions since
// the underlying data (categories, locations, items) can change.
const responseCache = new Map<string, QueryFilter>();

interface NLQueryPaletteProps {
  companyId: string | null;
  assignmentId: number | null;
}

export const NLQueryPalette = ({ companyId, assignmentId }: NLQueryPaletteProps) => {
  const [open, setOpen]         = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [clarify, setClarify]   = useState<string | null>(null);
  const [outOfContext, setOutOfContext] = useState(false);
  const [answer, setAnswer]     = useState<string | null>(null);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [filter, setFilter]     = useState<QueryFilter | null>(null);
  const [results, setResults]   = useState<InventoryItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global ⌘K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const reset = () => {
    setQuestion(""); setError(null); setClarify(null); setFilter(null); setResults([]);
    setOutOfContext(false); setAnswer(null);
  };

  const runFilter = useCallback(async (f: QueryFilter) => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const items = await SupabaseDataService.queryByFilter(f, companyId, assignmentId);
      setResults(items);
      setFilter(f);

      // Chat-style answer sentence, synthesized from the REAL results we
      // just fetched — never from raw data. The model only sees a count
      // and a handful of examples, so it cannot hallucinate a number.
      setAnswerLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const chips = filterToChips(f).map((c) => c.label).join(", ");

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nl-query`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              mode: "answer",
              question,
              resultCount: items.length,
              filterSummary: chips || "no filters",
              sampleItems: items.slice(0, 5).map((i) => ({
                name: i.name, sku: i.sku, physicalQty: i.physicalQuantity,
                systemQty: i.systemQuantity, status: i.status,
              })),
            }),
          }
        );
        const body = await res.json();
        if (res.ok && body.answer) setAnswer(body.answer);
      } catch {
        // Answer sentence is a nice-to-have — never block on it failing.
      } finally {
        setAnswerLoading(false);
      }

    } catch (e: any) {
      // Don't leak raw Postgres errors ("column i.variance does not
      // exist") straight to the UI — log them for debugging, show
      // something a non-technical user can act on instead.
      console.error("NL query RPC error:", e);
      setError("Couldn't run that query. Try rephrasing, or ask something simpler.");
    } finally {
      setLoading(false);
    }
  }, [companyId, assignmentId, question]);

  const handleSubmit = async () => {
    if (!question.trim() || !companyId) return;
    setError(null);
    setClarify(null);
    setOutOfContext(false);
    setAnswer(null);

    const cacheKey = normaliseQuery(question);
    const cached = responseCache.get(cacheKey);
    if (cached) {
      await runFilter(cached);
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nl-query`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ question, companyId, assignmentId }),
        }
      );

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);

      // Validate client-side too — never trust the edge function's JSON
      // blindly just because it parsed. A malformed or hostile shape
      // fails here instead of reaching the RPC.
      if (body.filter?.outOfContext) {
        setOutOfContext(true);
        setLoading(false);
        return;
      }

      if (body.filter?.clarify) {
        setClarify(body.filter.clarify);
        setLoading(false);
        return;
      }

      const parsed = QueryFilterSchema.safeParse(body.filter);
      if (!parsed.success) {
        setError("The model's response didn't match the expected format. Try rephrasing.");
        setLoading(false);
        return;
      }

      responseCache.set(cacheKey, parsed.data);
      await runFilter(parsed.data);

    } catch (e: any) {
      setError(e.message || "Something went wrong.");
      setLoading(false);
    }
  };

  const removeChip = (key: string) => {
    if (!filter) return;
    const next = { ...filter };
    delete (next as any)[key];
    runFilter(next);
  };

  const chips = filter ? filterToChips(filter) : [];

  return (
    <>
      {/* Trigger button — visible affordance alongside the ⌘K shortcut */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 text-slate-500 border-slate-200"
      >
        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        Ask a question
        <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] text-slate-400 ml-1">
          ⌘K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Ask your inventory
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              e.g. "Electronics with variance over 10% in Warehouse B"
            </DialogDescription>
          </DialogHeader>

          <div className="px-4 py-3">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Ask a question about your inventory…"
                className="pl-9 h-11"
                disabled={loading}
              />
            </div>
          </div>

          {/* Out of context — honest "I can't help with that" instead of forcing an answer */}
          {outOfContext && (
            <div className="mx-4 mb-3 flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <Ban className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
              <p className="text-[13px] text-slate-600">
                That question is outside what I can help with — I can only answer questions
                about your inventory, stock levels, discrepancies, and audit data.
              </p>
            </div>
          )}

          {/* Clarification — model asked instead of guessing */}
          {clarify && (
            <div className="mx-4 mb-3 flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <HelpCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[13px] text-blue-700">{clarify}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-4 mb-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[13px] text-red-700">{error}</p>
            </div>
          )}

          {/* Chat-style answer — one sentence synthesized from the REAL
              results above, never from raw data. Shown like a chat reply. */}
          {(answer || answerLoading) && !error && (
            <div className="mx-4 mb-3 flex items-start gap-2 p-3 rounded-lg bg-violet-50 border border-violet-100">
              <Sparkles className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
              {answerLoading ? (
                <span className="text-[13px] text-violet-400 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking through the results…
                </span>
              ) : (
                <p className="text-[13px] text-violet-800">{answer}</p>
              )}
            </div>
          )}

          {/* Chips — what the model understood, removable */}
          {chips.length > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <Badge
                  key={chip.key}
                  variant="outline"
                  className="gap-1 pr-1 text-[11px] border-violet-200 text-violet-700 bg-violet-50"
                >
                  {chip.label}
                  <button
                    onClick={() => removeChip(chip.key)}
                    className="ml-0.5 rounded-full hover:bg-violet-200 p-0.5"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Results */}
          <div className="border-t border-slate-100 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-[13px] text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {filter ? "Updating…" : "Thinking…"}
              </div>
            ) : results.length === 0 && filter ? (
              <div className="text-center py-10 text-[13px] text-slate-400">
                No items match this query.
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-10 text-[13px] text-slate-300">
                Ask a question to see results here.
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                <div className="px-4 py-2 text-[11px] text-slate-400 bg-slate-50/50">
                  {results.length} item{results.length !== 1 ? "s" : ""}
                </div>
                {results.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-800 truncate">
                        {item.name} <span className="text-slate-400 font-normal">· {item.sku}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {item.category} · {item.location}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-[12px] text-slate-500 font-mono">
                        {item.physicalQuantity ?? "—"} / {item.systemQuantity}
                      </span>
                      <span className={getStatusBadge(item.status)}>{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};