CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  credits INTEGER NOT NULL DEFAULT 10000,
  last_daily_claim TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, avatar_url, credits)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN NEW.is_anonymous THEN 1000 ELSE 10000 END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  model TEXT NOT NULL DEFAULT 'codex-0.1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chats all" ON public.chats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_chat_created_idx ON public.messages (chat_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own messages all" ON public.messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  kind TEXT NOT NULL CHECK (kind IN ('html','react')),
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.artifacts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artifacts TO authenticated;
GRANT ALL ON public.artifacts TO service_role;
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "artifacts public read" ON public.artifacts FOR SELECT TO anon USING (true);
CREATE POLICY "artifacts auth read" ON public.artifacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "artifacts owner write" ON public.artifacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "artifacts owner update" ON public.artifacts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "artifacts owner delete" ON public.artifacts FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_chats BEFORE UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;