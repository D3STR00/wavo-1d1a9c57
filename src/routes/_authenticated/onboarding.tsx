import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { INTENTS, type IntentKind } from "@/lib/wavo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome to Wavo" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [intent, setIntent] = useState<IntentKind | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const meta = data.user?.user_metadata as { first_name?: string } | undefined;
      if (meta?.first_name) setName(meta.first_name);
      const { data: p } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", data.user!.id)
        .maybeSingle();
      if (p?.first_name && !meta?.first_name) setName(p.first_name);
      // If they've already picked a name AND a live intent → skip
      const { data: existing } = await supabase
        .from("intents")
        .select("id")
        .eq("user_id", data.user!.id)
        .eq("status", "live")
        .limit(1);
      if (p?.first_name && existing && existing.length > 0) {
        navigate({ to: "/nearby" });
      }
    })();
  }, [navigate]);

  const submit = async () => {
    if (!intent || !name.trim()) return;
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user!.id;
    await supabase.from("profiles").update({ first_name: name.trim() }).eq("id", uid);
    await supabase.from("intents").insert({ user_id: uid, kind: intent, status: "live" });
    await supabase.from("user_presence").upsert({ user_id: uid, is_online: true, last_seen_at: new Date().toISOString() });
    navigate({ to: "/nearby" });
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-purple/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-brand-teal/30 blur-3xl" />
      <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <h1 className="font-display text-3xl font-bold">One quick thing.</h1>
        <p className="mt-2 text-sm text-foreground/70">
          Your name and what you're down for. No bio, no pressure — Wavo is about being here, not being seen.
        </p>

        <label className="mt-6 block">
          <span className="mb-1 block text-xs font-medium text-foreground/60">First name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none focus:ring-primary"
            placeholder="Alex"
          />
        </label>

        <div className="mt-6">
          <p className="mb-2 text-xs font-medium text-foreground/60">What are you down for?</p>
          <div className="grid grid-cols-2 gap-2">
            {INTENTS.map((i) => {
              const active = intent === i.kind;
              return (
                <button
                  key={i.kind}
                  onClick={() => setIntent(i.kind)}
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
        </div>

        <button
          onClick={submit}
          disabled={!intent || !name.trim() || loading}
          className="mt-8 w-full rounded-xl bg-gradient-to-r from-brand-purple to-brand-green py-3 text-sm font-semibold text-primary-foreground shadow-lg disabled:opacity-50"
        >
          Go live
        </button>
      </main>
    </div>
  );
}
