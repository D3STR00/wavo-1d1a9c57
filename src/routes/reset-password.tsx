import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Wavo" },
      { name: "description", content: "Set a new Wavo password and get back to live intents." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(window.location.search);
    const isRecovery = hashParams.get("type") === "recovery" || queryParams.get("type") === "recovery";

    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session) || isRecovery);
    });

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (password.length < 6) {
      setErr("Use at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErr("Passwords don’t match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setDone(true);
    setTimeout(() => navigate({ to: "/onboarding" }), 900);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-purple/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-brand-teal/30 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-8">
        <Link to="/auth" className="text-logo-gradient font-display text-5xl font-extrabold tracking-tight">
          wavo
        </Link>

        <form onSubmit={submit} className="mt-7 space-y-4 rounded-3xl bg-card/70 p-5 shadow-2xl shadow-background/40 ring-1 ring-white/10 backdrop-blur-xl">
          <div>
            <h1 className="font-display text-2xl font-bold">Set new password</h1>
            <p className="mt-1 text-sm leading-5 text-foreground/58">
              {ready
                ? "Choose a new password and jump back into Wavo."
                : "Open this page from the reset email so Wavo can verify it’s you."}
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-foreground/60">New password</span>
            <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10 focus-within:ring-primary">
              <Lock className="h-4 w-4 text-foreground/40" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={!ready || done}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/30 disabled:opacity-50"
                placeholder="At least 6 characters"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-foreground/60">Confirm password</span>
            <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10 focus-within:ring-primary">
              <Lock className="h-4 w-4 text-foreground/40" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={!ready || done}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/30 disabled:opacity-50"
                placeholder="Repeat password"
              />
            </div>
          </label>

          {err && <div className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive ring-1 ring-destructive/20">{err}</div>}
          {done && <div className="rounded-2xl bg-brand-green/10 p-3 text-sm text-foreground ring-1 ring-brand-green/25">Password updated. Taking you in…</div>}

          <button
            type="submit"
            disabled={!ready || loading || done}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-green py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-brand-purple/20 transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "…" : "Update password"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
      </main>
    </div>
  );
}