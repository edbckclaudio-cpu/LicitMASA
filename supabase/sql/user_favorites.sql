-- Tabela de favoritos de licitações
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  pncp_id TEXT NOT NULL,
  objeto_resumo TEXT NOT NULL,
  orgao_nome TEXT NOT NULL,
  valor_estimado NUMERIC,
  link_edital TEXT,
  data_abertura TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, pncp_id)
);

-- Habilitar RLS
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- Políticas: o usuário só acessa seus próprios favoritos
CREATE POLICY "Users can view own favorites"
ON public.user_favorites FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
ON public.user_favorites FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
ON public.user_favorites FOR DELETE
USING (auth.uid() = user_id);
