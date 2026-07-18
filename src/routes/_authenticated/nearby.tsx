import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WavoBanner } from "@/components/wavo/wavo-banner";
import { IntentCard, type NearbyItem } from "@/components/wavo/intent-card";
import { WavoAlert, type IncomingWave } from "@/components/wavo/wavo-alert";
import { BottomNav } from "@/components/wavo/bottom-nav";
import { GoLiveControl } from "@/components/wavo/go-live";
import { RadarPulse } from "@/components/wavo/radar-pulse";
import { MatchModal, type MatchInfo } from "@/components/wavo/match-modal";
import type { IntentKind } from "@/lib/wavo";

export const Route = createFileRoute("/_authenticated/nearby")({
  head: () => ({ meta: [{ title: "Nearby — Wavo" }] }),
  component: NearbyPage,
});

type ProfileRow = { id: string; first_name: string };
type IntentRow = {
  id: string;
  user_id: string;
  kind: IntentKind;
  message: string | null;
  created_at: string;
  status: "live" | "idle" | "matched";
  expires_at: string;
};
type WaveRow = {
  id: string;
  from_user: string;
  to_user: string;
  intent_kind: IntentKind;
  status: "sent" | "returned" | "passed" | "expired";
  created_at: string;
};
type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  intent_kind: IntentKind;
};

export default function NearbyPage() {
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [filter, setFilter] = useState<IntentKind | null>(null);
  const [intents, setIntents] = useState<IntentRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [waves, setWaves] = useState<WaveRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [incoming, setIncoming] = useState<IncomingWave | null>(null);

  // Bootstrap
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user!.id;
      setUid(id);

      const { data: prof } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", id)
        .maybeSingle();
      if (!prof?.first_name) {
        navigate({ to: "/onboarding" });
        return;
      }

      await Promise.all([loadIntents(), loadWaves(id), loadMatches(id)]);
    })();

    const heartbeat = setInterval(async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from("user_presence").upsert({
          user_id: data.user.id,
          last_seen_at: new Date().toISOString(),
        });
      }
    }, 45_000);

    return () => clearInterval(heartbeat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadIntents() {
    const { data } = await supabase
      .from("intents")
      .select("*")
      .eq("status", "live")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as IntentRow[];
    setIntents(rows);
    const ids = [...new Set(rows.map((r) => r.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name")
        .in("id", ids);
      const map: Record<string, ProfileRow> = {};
      (profs ?? []).forEach((p) => (map[p.id] = p as ProfileRow));
      setProfiles((prev) => ({ ...prev, ...map }));
    }
  }

  async function loadWaves(myId: string) {
    const { data } = await supabase
      .from("waves")
      .select("*")
      .or(`from_user.eq.${myId},to_user.eq.${myId}`)
      .in("status", ["sent", "returned"])
      .order("created_at", { ascending: false })
      .limit(100);
    setWaves((data ?? []) as WaveRow[]);
  }

  async function loadMatches(myId: string) {
    const { data } = await supabase
      .from("matches")
      .select("*")
      .or(`user_a.eq.${myId},user_b.eq.${myId}`)
      .order("created_at", { ascending: false });
    setMatches((data ?? []) as MatchRow[]);
  }

  // Realtime subscriptions
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel("wavo-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "intents" }, () => loadIntents())
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "waves", filter: `to_user=eq.${uid}` },
        async (payload) => {
          const w = payload.new as WaveRow;
          if (w.status !== "sent") return;
          // fetch sender name
          const { data: p } = await supabase
            .from("profiles")
            .select("first_name")
            .eq("id", w.from_user)
            .maybeSingle();
          setIncoming({
            waveId: w.id,
            fromUserId: w.from_user,
            fromName: p?.first_name ?? "Someone",
            intent: w.intent_kind,
          });
          loadWaves(uid);
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "waves" }, () => loadWaves(uid))
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => loadMatches(uid))
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid]);

  const matchedPairs = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      set.add(`${m.user_a}:${m.intent_kind}`);
      set.add(`${m.user_b}:${m.intent_kind}`);
    });
    return set;
  }, [matches]);

  const wavedTo = useMemo(() => {
    const set = new Set<string>();
    waves.forEach((w) => {
      if (w.from_user === uid) set.add(`${w.to_user}:${w.intent_kind}`);
    });
    return set;
  }, [waves, uid]);

  const items: NearbyItem[] = useMemo(() => {
    return intents
      .filter((i) => i.user_id !== uid)
      .filter((i) => (filter ? i.kind === filter : true))
      .map((i) => {
        const key = `${i.user_id}:${i.kind}`;
        const matched = matchedPairs.has(key);
        const sent = wavedTo.has(key);
        return {
          userId: i.user_id,
          name: profiles[i.user_id]?.first_name || "Someone",
          intent: i.kind,
          message: i.message,
          createdAt: i.created_at,
          expiresAt: i.expires_at,
          state: matched ? "matched" : "available",
          waveState: matched ? "matched" : sent ? "sent" : "idle",
        };
      });
  }, [intents, uid, filter, profiles, matchedPairs, wavedTo]);

  const liveCount = intents.filter((i) => i.user_id !== uid).length;

  async function sendWave(item: NearbyItem) {
    if (!uid) return;
    await supabase.from("waves").insert({
      from_user: uid,
      to_user: item.userId,
      intent_kind: item.intent,
      status: "sent",
    });
    // Check if there was already a wave from them → convert to returned (mutual)
    const { data: prior } = await supabase
      .from("waves")
      .select("id, status")
      .eq("from_user", item.userId)
      .eq("to_user", uid)
      .eq("intent_kind", item.intent)
      .eq("status", "sent")
      .limit(1)
      .maybeSingle();
    if (prior) {
      await supabase.from("waves").update({ status: "returned" }).eq("id", prior.id);
    }
    loadWaves(uid);
  }

  async function waveBack(w: IncomingWave) {
    await supabase.from("waves").update({ status: "returned" }).eq("id", w.waveId);
    setIncoming(null);
    if (uid) loadWaves(uid);
  }

  async function passWave(w: IncomingWave) {
    await supabase.from("waves").update({ status: "passed" }).eq("id", w.waveId);
    setIncoming(null);
  }

  const myIntent = useMemo(
    () => intents.find((i) => i.user_id === uid) ?? null,
    [intents, uid],
  );

  return (
    <div className="min-h-screen pb-24">
      <WavoAlert wave={incoming} onWaveBack={waveBack} onPass={passWave} />
      <WavoBanner liveCount={liveCount} selected={filter} onSelect={setFilter} />

      <main className="mx-auto max-w-xl px-4 pt-4 space-y-4">
        {uid && (
          <GoLiveControl
            uid={uid}
            live={
              myIntent
                ? { id: myIntent.id, kind: myIntent.kind, createdAt: myIntent.created_at }
                : null
            }
            onChange={() => {
              loadIntents();
            }}
          />
        )}

        <div className="flex items-center justify-between pt-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/50">
            Live wall
          </h2>
          <span className="text-xs text-foreground/40 tabular-nums">
            {items.length} nearby
          </span>
        </div>

        {items.length === 0 ? (
          <EmptyState intent={myIntent?.kind} />
        ) : (
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={`${it.userId}-${it.intent}`}>
                <IntentCard item={it} onWave={() => sendWave(it)} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function EmptyState({ intent }: { intent?: IntentKind }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card/40 p-6 text-center ring-1 ring-white/10">
      <RadarPulse intent={intent} />
      <p className="mt-4 font-display text-lg font-semibold">Scanning nearby…</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-foreground/60">
        You're broadcasting live. The moment someone within range shares an intent,
        they'll pop up here.
      </p>
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-3 py-1 text-xs font-semibold text-brand-green ring-1 ring-brand-green/25">
        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-brand-green" />
        Live · realtime
      </div>
    </div>
  );
}

