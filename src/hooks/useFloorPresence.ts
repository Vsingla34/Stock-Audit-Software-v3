// src/hooks/useFloorPresence.ts
//
// Build 03 — presence is a different Realtime primitive from
// postgres_changes: ephemeral state held in the channel itself, not rows
// in a table. Kept on its own channel (floor-{assignmentId}) so it can
// never interfere with InventoryContext's existing batched postgres_changes
// subscription on live-dashboard-{companyId}-{assignmentId}.

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/context/UserContext";

export interface FloorPresenceEntry {
  auditorId: string;
  auditorName: string;
  subLocation: string;
  lastScanAt: string;
}

// Presence state keyed by user id. Multiple browser tabs from the same
// auditor collapse into one key, which is the right behaviour here.
type PresenceState = Record<string, FloorPresenceEntry[]>;

const TRACK_THROTTLE_MS = 5000;

export function useFloorPresence(assignmentId: number | null, currentSubLocation?: string) {
  const { currentUser } = useUser();
  const [presence, setPresence] = useState<PresenceState>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTrackRef = useRef(0);

  const track = useCallback((subLocation: string) => {
    const now = Date.now();
    if (now - lastTrackRef.current < TRACK_THROTTLE_MS) return;
    lastTrackRef.current = now;

    channelRef.current?.track({
      auditorId: currentUser?.id,
      auditorName: currentUser?.name || currentUser?.email || "Auditor",
      subLocation,
      lastScanAt: new Date().toISOString(),
    });
  }, [currentUser]);

  useEffect(() => {
    if (!assignmentId || !currentUser?.id) return;

    const channel = supabase.channel(`floor-${assignmentId}`, {
      config: { presence: { key: currentUser.id } },
    });

    channel.on("presence", { event: "sync" }, () => {
      // Presence state is replaced wholesale on each sync — always
      // send the complete object, never a partial patch.
      setPresence(channel.presenceState() as unknown as PresenceState);
    });

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      await channel.track({
        auditorId: currentUser.id,
        auditorName: currentUser.name || currentUser.email || "Auditor",
        subLocation: currentSubLocation || "Unassigned",
        lastScanAt: new Date().toISOString(),
      });
    });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, currentUser?.id]);

  // Re-track (throttled) whenever the caller's current sub-location changes
  // — e.g. after each scan, the Scanner page calls this with the item's
  // subLocation.
  useEffect(() => {
    if (currentSubLocation) track(currentSubLocation);
  }, [currentSubLocation, track]);

  // Flatten presence state into a simple array of "who's where right now"
  const activeAuditors: FloorPresenceEntry[] = Object.values(presence)
    .map((entries) => entries[0])
    .filter(Boolean);

  return { activeAuditors, track };
}