import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock, Mail, Sparkles, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
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
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/nearby" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("Password reset sent. Check your email, then come back here.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: firstName || email.split("@")[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/onboarding" });
        } else {
          setNotice("Account created. Check your email to finish signing in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/onboarding" });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong";
      setErr(
        message.toLowerCase().includes("invalid login")
          ? "That email/password didn’t work. If you’re new, tap Create account — if you already signed up, reset your password."
          : message,
      );
    } finally {
      setLoading(false);
    }
  };

  const selectMode = (nextMode: "signin" | "signup" | "reset") => {
    setMode(nextMode);
    setErr(null);
    setNotice(null);
  };

  const isReset = mode === "reset";
  const title = isReset ? "Reset password" : mode === "signup" ? "Create account" : "Welcome back";
  const cta = loading ? "…" : isReset ? "Send reset link" : mode === "signup" ? "Create account" : "Sign in";

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-purple/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-brand-teal/30 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-8">
        <div className="mb-7">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-foreground/70 ring-1 ring-white/10">
            <Sparkles className="h-3.5 w-3.5 text-brand-green" />
            Intent → Vibe → Meet
          </div>
          <h1 className="text-logo-gradient font-display text-6xl font-extrabold tracking-tight">
            wavo
          </h1>
          <p className="mt-3 text-base leading-6 text-foreground/72">
            Say what you want to do right now. Find people nearby who are down.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-3xl bg-card/70 p-5 shadow-2xl shadow-background/40 ring-1 ring-white/10 backdrop-blur-xl">
          <div>
            <h2 className="font-display text-2xl font-bold">{title}</h2>
            <p className="mt-1 text-sm text-foreground/58">
              {isReset
                ? "Enter your email and we’ll send a link to unlock your account."
                : mode === "signup"
                  ? "New to Wavo? Start here — this is the fastest way in."
                  : "Already created your account? Sign in here."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => selectMode("signup")}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                mode === "signup" ? "bg-foreground text-background" : "text-foreground/58 hover:text-foreground"
              }`}
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => selectMode("signin")}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                mode === "signin" ? "bg-foreground text-background" : "text-foreground/58 hover:text-foreground"
              }`}
            >
              Sign in
            </button>
          </div>

          {mode === "signup" && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-foreground/60">First name</span>
              <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10 focus-within:ring-primary">
                <UserPlus className="h-4 w-4 text-foreground/40" />
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/30"
                  placeholder="Alex"
                />
              </div>
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-foreground/60">Email</span>
            <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10 focus-within:ring-primary">
              <Mail className="h-4 w-4 text-foreground/40" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/30"
                placeholder="you@wavo.app"
              />
            </div>
          </label>

          {!isReset && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-foreground/60">Password</span>
              <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10 focus-within:ring-primary">
                <Lock className="h-4 w-4 text-foreground/40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/30"
                  placeholder="At least 6 characters"
                />
              </div>
            </label>
          )}

          {err && (
            <div className="rounded-2xl bg-destructive/10 p-3 text-sm leading-5 text-destructive ring-1 ring-destructive/20">
              {err}
              {mode === "signin" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => selectMode("signup")} className="font-semibold text-foreground underline underline-offset-4">
                    Create account
                  </button>
                  <button type="button" onClick={() => selectMode("reset")} className="font-semibold text-foreground underline underline-offset-4">
                    Reset password
                  </button>
                </div>
              )}
            </div>
          )}
          {notice && (
            <div className="rounded-2xl bg-brand-green/10 p-3 text-sm leading-5 text-foreground ring-1 ring-brand-green/25">
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-green py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-brand-purple/20 transition hover:brightness-110 disabled:opacity-70"
          >
            {cta}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-foreground/58">
          <button onClick={() => selectMode(mode === "signup" ? "signin" : "signup")} className="hover:text-foreground">
            {mode === "signup" ? "Have an account? Sign in" : "New here? Create account"}
          </button>
          <button onClick={() => selectMode("reset")} className="hover:text-foreground">
            Forgot password?
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-foreground/40 leading-5">
          If you opened an email reset link, use the secure reset page. {" "}
          <Link to="/reset-password" className="text-foreground/70 underline underline-offset-4">
            Set a new password
          </Link>
        </p>
      </main>
    </div>
  );
}
