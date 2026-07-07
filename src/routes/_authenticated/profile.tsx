import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/wavo/bottom-nav";
import { INTENTS, initialsFor, type IntentKind } from "@/lib/wavo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Wavo" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [live, setLive] = useState<{ id: string; kind: IntentKind } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user!.id;
      setEmail(data.user!.email ?? "");
      const { data: p } = await supabase.from("profiles").select("first_name").eq("id", id).maybeSingle();
      setName(p?.first_name ?? "");
      const { data: i } = await supabase
        .from("intents")
        .select("id, kind")
        .eq("user_id", id)
        .eq("status", "live")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLive(i ? { id: i.id, kind: i.kind as IntentKind } : null);
    })();
  }, []);

  async function switchIntent(kind: IntentKind) {
    setSaving(true);
    const { data } = await supabase.auth.getUser();
    const id = data.user!.id;
    // Expire any live intent
    await supabase.from("intents").update({ status: "idle" }).eq("user_id", id).eq("status", "live");
    const { data: created } = await supabase
      .from("intents")
      .insert({ user_id: id, kind, status: "live" })
      .select("id, kind")
      .single();
    setLive(created ? { id: created.id, kind: created.kind as IntentKind } : null);
    setSaving(false);
  }

  async function goOffline() {
    setSaving(true);
    const { data } = await supabase.auth.getUser();
    const id = data.user!.id;
    await supabase.from("intents").update({ status: "idle" }).eq("user_id", id).eq("status", "live");
    await supabase.from("user_presence").upsert({ user_id: id, is_online: false, last_seen_at: new Date().toISOString() });
    setLive(null);
    setSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function saveName() {
    setSaving(true);
    const { data } = await supabase.auth.getUser();
    await supabase.from("profiles").update({ first_name: name.trim() }).eq("id", data.user!.id);
    setSaving(false);
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="border-b border-white/5 px-5 pt-8 pb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple to-brand-green text-lg font-bold ring-2 ring-white/20">
            {initialsFor(name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-bold">{name || "You"}</p>
            <p className="truncate text-xs text-foreground/50">{email}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-6 px-4 pt-6">
        <section>
          <label className="mb-1 block text-xs font-medium text-foreground/60">First name</label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              className="flex-1 rounded-xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-primary"
            />
          </div>
          <p className="mt-1 text-xs text-foreground/40">
            That's it. Wavo doesn't reward presentation, only presence.
          </p>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-foreground/60">Current intent</p>
            {live && (
              <button onClick={goOffline} className="text-xs text-foreground/50 hover:text-foreground">
                Go offline
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {INTENTS.map((i) => {
              const active = live?.kind === i.kind;
              return (
                <button
                  key={i.kind}
                  disabled={saving}
                  onClick={() => switchIntent(i.kind)}
                  className={cn(
                    "rounded-2xl p-4 text-left ring-1 transition",
                    i.bg,
                    active ? "ring-primary" : "ring-white/10 opacity-70 hover:opacity-100",
                  )}
                >
                  <div className="text-2xl">{i.emoji}</div>
                  <div className="mt-1 font-semibold">{i.label}</div>
                </button>
              );
            })}
          </div>
        </section>

        <button
          onClick={signOut}
          className="w-full rounded-xl bg-white/5 py-3 text-sm font-semibold text-foreground/70 ring-1 ring-white/10 hover:bg-white/10"
        >
          Sign out
        </button>
      </main>
      <BottomNav />
    </div>
  );
}
