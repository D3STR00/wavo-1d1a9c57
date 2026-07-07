import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { intentBy, initialsFor, type IntentKind } from "@/lib/wavo";

export const Route = createFileRoute("/_authenticated/chat/$matchId")({
  head: () => ({ meta: [{ title: "Chat — Wavo" }] }),
  component: ChatRoom,
});

type Msg = { id: string; user_id: string; body: string; created_at: string };
type MatchInfo = { id: string; intent_kind: IntentKind; other: { id: string; first_name: string } };

function ChatRoom() {
  const { matchId } = Route.useParams();
  const navigate = useNavigate();
  const [uid, setUid] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data.user!.id;
      setUid(id);
      const { data: m } = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle();
      if (!m) return navigate({ to: "/chat" });
      const otherId = m.user_a === id ? m.user_b : m.user_a;
      const { data: p } = await supabase.from("profiles").select("id, first_name").eq("id", otherId).maybeSingle();
      setMatch({
        id: m.id,
        intent_kind: m.intent_kind as IntentKind,
        other: p ?? { id: otherId, first_name: "Someone" },
      });
      const { data: rows } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });
      setMsgs(rows ?? []);
    })();
  }, [matchId, navigate]);

  useEffect(() => {
    const ch = supabase
      .channel(`chat-${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `match_id=eq.${matchId}` },
        (payload) => setMsgs((cur) => [...cur, payload.new as Msg]),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [matchId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  async function send() {
    if (!text.trim() || !uid) return;
    const body = text.trim();
    setText("");
    await supabase.from("chat_messages").insert({ match_id: matchId, user_id: uid, body });
  }

  if (!match) return <div className="min-h-screen" />;
  const intent = intentBy(match.intent_kind);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-white/5 bg-background/80 px-4 py-3 backdrop-blur">
        <Link to="/chat" className="rounded-full p-2 hover:bg-white/5">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${intent.glow} ring-2 ring-white/20 text-sm font-semibold`}>
          {initialsFor(match.other.first_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{match.other.first_name}</p>
          <p className="text-xs text-foreground/60">
            {intent.emoji} {intent.label} · matched
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && (
          <p className="mx-auto mt-8 max-w-xs text-center text-sm text-foreground/50">
            You matched on {intent.label.toLowerCase()}. Say hi — meet in real life, don't just chat.
          </p>
        )}
        {msgs.map((m) => {
          const mine = m.user_id === uid;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                  mine
                    ? "bg-gradient-to-br from-brand-purple to-brand-green text-primary-foreground"
                    : "bg-card ring-1 ring-white/10"
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t border-white/5 bg-background/80 p-3 backdrop-blur"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          className="flex-1 rounded-full bg-white/5 px-4 py-2.5 text-sm ring-1 ring-white/10 outline-none focus:ring-primary"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-full bg-gradient-to-r from-brand-purple to-brand-green p-3 text-primary-foreground disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
