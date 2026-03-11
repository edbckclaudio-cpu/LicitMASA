-- Habilitar RLS na tabela profiles
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT próprio profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can select own profile'
  ) THEN
    CREATE POLICY "Users can select own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);
  END IF;
END $$;

-- Policy: INSERT próprio profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Policy: UPDATE próprio profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- search_alerts já possui políticas específicas no repositório.
-- Caso queira uma única policy agregada (FOR ALL), use no Dashboard:
-- ALTER POLICY "Users can manage own alerts" ON public.search_alerts FOR ALL USING (auth.uid() = user_id);

