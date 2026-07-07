import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    // On the client we redirect based on session; on SSR we send to /auth
    // and the auth page itself will bounce authenticated users forward.
    if (typeof window === "undefined") {
      throw redirect({ to: "/auth" });
    }
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/nearby" : "/auth" });
  },
  component: () => null,
});
