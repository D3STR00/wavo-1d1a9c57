import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/wavo/bottom-nav";
import { intentBy, initialsFor, timeAgo, type IntentKind } from "@/lib/wavo";

export const Route = createFileRoute("/_authenticated/chat/")({
  head: () => ({ meta: [{ title: "Chat — Wavo" }] }),
  component: ChatList,
});

type Row = {
  id: string;
  user_a: string;
  user_b: string;
  intent_kind: IntentKind;
  created_at: string;
  other: { id: string; first_name: string };
};

function ChatList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user!.id;
      setUid(id);
      const { data: m } = await supabase
        .from("matches")
        .select("*")
        .or(`user_a.eq.${id},user_b.eq.${id}`)
        .order("created_at", { ascending: false });
      const list = m ?? [];
      const otherIds = [...new Set(list.map((r) => (r.user_a === id ? r.user_b : r.user_a)))];
      const { data: profs } = otherIds.length
        ? await supabase.from("profiles").select("id, first_name").in("id", otherIds)
        : { data: [] };
      const map = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
      setRows(
        list.map((r) => {
          const otherId = r.user_a === id ? r.user_b : r.user_a;
          return {
            id: r.id,
            user_a: r.user_a,
            user_b: r.user_b,
            intent_kind: r.intent_kind as IntentKind,
            created_at: r.created_at,
            other: map[otherId] ?? { id: otherId, first_name: "Someone" },
          };
        }),
      );
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-white/5 px-5 pt-8 pb-4">
        <h1 className="font-display text-2xl font-bold">Chat</h1>
        <p className="mt-1 text-sm text-foreground/60">Only matches show up here.</p>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-4">
        {loading ? (
          <p className="text-center text-sm text-foreground/50">…</p>
        ) : rows.length === 0 ? (
          <div className="mt-10 rounded-2xl bg-card/40 p-6 text-center ring-1 ring-white/10">
            <div className="text-3xl">💬</div>
            <p className="mt-2 font-semibold">No matches yet</p>
            <p className="mt-1 text-sm text-foreground/60">
              Wave at someone on Nearby. If they wave back, chat unlocks here.
            </p>
            <Link
              to="/nearby"
              className="mt-4 inline-flex rounded-full bg-gradient-to-r from-brand-purple to-brand-green px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Go to Nearby
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const intent = intentBy(r.intent_kind);
              return (
                <li key={r.id}>
                  <Link
                    to="/chat/$matchId"
                    params={{ matchId: r.id }}
                    className="flex items-center gap-3 rounded-2xl bg-card/60 p-3 ring-1 ring-white/10 hover:bg-card"
                  >
                    <div className={`flex h-11 w-11 items-center justify-center rounded-full ${intent.glow} ring-2 ring-white/20 text-sm font-semibold`}>
                      {initialsFor(r.other.first_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.other.first_name}</p>
                      <p className="text-xs text-foreground/60">
                        {intent.emoji} {intent.label} · matched {timeAgo(r.created_at)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
