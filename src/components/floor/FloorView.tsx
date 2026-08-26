// src/components/floor/FloorView.tsx
//
// Build 03 — Activity map (not progress map). Deliberately labelled as
// such throughout: without pre-assigned expected-item counts per
// sub-location, there is no honest way to show a completion percentage.
// This shows WHERE scanning is happening right now and WHO is there —
// which is still genuinely useful for an admin watching a live count.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFloorPresence, FloorPresenceEntry } from "@/hooks/useFloorPresence";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Users, AlertTriangle, Clock, Radio } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityRow {
  sub_location: string;
  counted_items: number;
  discrepancies: number;
  last_activity: string | null;
}

const POLL_INTERVAL_MS = 10000;

// ── Avatar cluster for auditors present at a tile ────────────────────────

const AuditorAvatars = ({ auditors }: { auditors: FloorPresenceEntry[] }) => {
  if (auditors.length === 0) return null;
  const shown = auditors.slice(0, 3);
  const extra = auditors.length - shown.length;

  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((a) => (
        <div
          key={a.auditorId}
          title={a.auditorName}
          className="h-6 w-6 rounded-full bg-violet-600 text-white text-[10px] font-semibold
                     flex items-center justify-center border-2 border-white shrink-0"
        >
          {a.auditorName.charAt(0).toUpperCase()}
        </div>
      ))}
      {extra > 0 && (
        <div className="h-6 w-6 rounded-full bg-slate-300 text-slate-700 text-[10px] font-semibold
                        flex items-center justify-center border-2 border-white shrink-0">
          +{extra}
        </div>
      )}
    </div>
  );
};

// ── Single tile ────────────────────────────────────────────────────────────

const FloorTile = ({
  row, activeHere,
}: { row: ActivityRow; activeHere: FloorPresenceEntry[] }) => {
  const isLive = activeHere.length > 0;
  const hasDiscrepancies = row.discrepancies > 0;

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-300 ${
        isLive
          ? "border-violet-300 bg-violet-50/60 shadow-[0_0_0_1px_rgba(124,58,237,0.15)]"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className={`h-3.5 w-3.5 shrink-0 ${isLive ? "text-violet-500" : "text-slate-400"}`} />
          <p className="text-[13px] font-semibold text-slate-800 truncate">{row.sub_location}</p>
        </div>
        {isLive && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-violet-600 shrink-0">
            <Radio className="h-2.5 w-2.5 animate-pulse" />
            Live
          </span>
        )}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-900">{row.counted_items}</p>
          <p className="text-[10px] text-slate-400">items scanned</p>
        </div>

        {hasDiscrepancies && (
          <div className="flex items-center gap-1 text-red-600 text-[11px] font-medium">
            <AlertTriangle className="h-3 w-3" />
            {row.discrepancies}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
        <AuditorAvatars auditors={activeHere} />
        {row.last_activity && (
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <Clock className="h-2.5 w-2.5" />
            {formatDistanceToNow(new Date(row.last_activity), { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────────────

interface FloorViewProps {
  assignmentId: number | null;
}

export const FloorView = ({ assignmentId }: FloorViewProps) => {
  const [rows, setRows]       = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const { activeAuditors } = useFloorPresence(assignmentId);

  const fetchActivity = useCallback(async () => {
    if (!assignmentId) return;
    const { data, error } = await (supabase.rpc as any)("get_floor_activity", {
      p_assignment_id: assignmentId,
    });
    if (error) {
      console.error("Failed to load floor activity:", error);
    } else {
      setRows((data as ActivityRow[]) || []);
    }
    setLoading(false);
  }, [assignmentId]);

  useEffect(() => {
    setLoading(true);
    fetchActivity();
  }, [fetchActivity]);

  // Poll every 10s for counted-item numbers. Presence carries the
  // "someone is here right now" signal instantly via its own channel —
  // this poll only refreshes the aggregate counts, not who's present.
  useEffect(() => {
    if (!assignmentId) return;
    const interval = setInterval(fetchActivity, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [assignmentId, fetchActivity]);

  // Refresh counts immediately when presence changes — someone showing up
  // usually means they're about to scan, so a fresh count read is cheap
  // and keeps things feeling responsive.
  useEffect(() => {
    fetchActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAuditors.length]);

  if (!assignmentId) {
    return (
      <div className="text-center py-12 text-[13px] text-slate-400">
        Select an assignment to see live floor activity.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Honesty banner — this is an activity map, not a progress tracker */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-700">
          This shows <strong>where scanning is happening</strong>, not completion percentage.
          Sub-locations are discovered from scans as they happen — there's no way to know how
          many items are expected at each one yet.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-[13px] text-slate-500">No scanning activity yet for this assignment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {rows.map((row) => {
            const activeHere = activeAuditors.filter(
              (a) => a.subLocation === row.sub_location
            );
            return <FloorTile key={row.sub_location} row={row} activeHere={activeHere} />;
          })}
        </div>
      )}

      {activeAuditors.length > 0 && (
        <p className="text-[11px] text-slate-400 text-center">
          {activeAuditors.length} auditor{activeAuditors.length !== 1 ? "s" : ""} currently active
        </p>
      )}
    </div>
  );
};