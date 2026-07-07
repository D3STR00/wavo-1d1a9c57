import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Wavo" },
      { name: "description", content: "Sign in to Wavo — real-time intent, near you." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/nearby" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: firstName || email.split("@")[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        // If email confirmation is off, session is live now
        const { data } = await supabase.auth.getUser();
        navigate({ to: data.user ? "/onboarding" : "/auth" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/nearby" });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-purple/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-brand-teal/30 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-8">
          <h1 className="text-logo-gradient font-display text-5xl font-extrabold tracking-tight">
            wavo
          </h1>
          <p className="mt-3 text-sm text-foreground/70">
            Say what you want to do right now. Find people nearby who are down.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-card/60 p-5 ring-1 ring-white/10 backdrop-blur">
          {mode === "signup" && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-foreground/60">First name</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-foreground ring-1 ring-white/10 outline-none focus:ring-primary"
                placeholder="Alex"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-foreground/60">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-foreground ring-1 ring-white/10 outline-none focus:ring-primary"
              placeholder="you@wavo.app"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-foreground/60">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-foreground ring-1 ring-white/10 outline-none focus:ring-primary"
              placeholder="At least 6 characters"
            />
          </label>

          {err && <p className="text-sm text-destructive">{err}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-brand-purple to-brand-green py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:brightness-110 disabled:opacity-70"
          >
            {loading ? "…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="mt-4 text-center text-sm text-foreground/60 hover:text-foreground"
        >
          {mode === "signup" ? "Have an account? Sign in" : "New here? Create an account"}
        </button>

        <p className="mt-8 text-center text-xs text-foreground/40">
          Intent → Vibe → Meet
        </p>
      </main>
    </div>
  );
}
