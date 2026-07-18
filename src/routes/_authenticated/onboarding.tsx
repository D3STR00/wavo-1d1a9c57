import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Welcome to Wavo" }] }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      if (p?.first_name) {
        if (!meta?.first_name) setName(p.first_name);
        navigate({ to: "/nearby" });
      }
    })();
  }, [navigate]);

  const submit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user!.id;
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({ id: uid, first_name: name.trim(), avatar_seed: uid }, { onConflict: "id" });
      if (profileError) throw profileError;
      navigate({ to: "/nearby" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t finish setup. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-purple/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-brand-teal/30 blur-3xl" />
      <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <h1 className="font-display text-3xl font-bold">One quick thing.</h1>
        <p className="mt-2 text-sm text-foreground/70">
          Just your first name. You'll choose what you're down for when you go live.
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

        <button
          onClick={submit}
          disabled={!name.trim() || loading}
          className="mt-8 w-full rounded-xl bg-gradient-to-r from-brand-purple to-brand-green py-3 text-sm font-semibold text-primary-foreground shadow-lg disabled:opacity-50"
        >
          {loading ? "…" : "Continue"}
        </button>
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
      </main>
    </div>
  );
}
