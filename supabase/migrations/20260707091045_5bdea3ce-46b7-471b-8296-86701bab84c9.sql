
-- Enums
CREATE TYPE public.intent_kind AS ENUM ('coffee','walk','talk','gym');
CREATE TYPE public.intent_status AS ENUM ('live','idle','matched');
CREATE TYPE public.wave_status AS ENUM ('sent','returned','passed','expired');

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  avatar_seed TEXT NOT NULL DEFAULT '',
  vibe_line TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by signed in" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- intents
CREATE TABLE public.intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind public.intent_kind NOT NULL,
  status public.intent_status NOT NULL DEFAULT 'live',
  message TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intents TO authenticated;
GRANT ALL ON public.intents TO service_role;
ALTER TABLE public.intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intents readable by signed in" ON public.intents FOR SELECT TO authenticated USING (true);
CREATE POLICY "intents insert own" ON public.intents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "intents update own" ON public.intents FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "intents delete own" ON public.intents FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX intents_live_idx ON public.intents(kind, expires_at) WHERE status = 'live';

-- user_presence
CREATE TABLE public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_online BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presence readable by signed in" ON public.user_presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "presence upsert own" ON public.user_presence FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "presence update own" ON public.user_presence FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- waves
CREATE TABLE public.waves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  to_user UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  intent_kind public.intent_kind NOT NULL,
  status public.wave_status NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waves TO authenticated;
GRANT ALL ON public.waves TO service_role;
ALTER TABLE public.waves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waves view mine" ON public.waves FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "waves send" ON public.waves FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user AND from_user <> to_user);
CREATE POLICY "waves update participant" ON public.waves FOR UPDATE TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE INDEX waves_to_user_idx ON public.waves(to_user, created_at DESC);

-- matches
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  intent_kind public.intent_kind NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT match_pair_ordered CHECK (user_a < user_b),
  UNIQUE (user_a, user_b, intent_kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches view participant" ON public.matches FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "matches insert participant" ON public.matches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

-- chat_messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat view match members" ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));
CREATE POLICY "chat send as self in match" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid()))
  );
CREATE INDEX chat_match_idx ON public.chat_messages(match_id, created_at);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, avatar_seed)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)), NEW.id::text);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Wave → match auto-create when mutual
CREATE OR REPLACE FUNCTION public.handle_wave_returned()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a UUID; b UUID;
BEGIN
  IF NEW.status = 'returned' AND (OLD.status IS DISTINCT FROM 'returned') THEN
    a := LEAST(NEW.from_user, NEW.to_user);
    b := GREATEST(NEW.from_user, NEW.to_user);
    INSERT INTO public.matches (user_a, user_b, intent_kind)
    VALUES (a, b, NEW.intent_kind)
    ON CONFLICT (user_a, user_b, intent_kind) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER wave_returned_makes_match AFTER UPDATE ON public.waves
  FOR EACH ROW EXECUTE FUNCTION public.handle_wave_returned();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.waves;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.intents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
