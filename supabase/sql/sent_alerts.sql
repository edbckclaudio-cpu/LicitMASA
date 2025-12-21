-- Tabela de notificações já enviadas para evitar duplicidade
CREATE TABLE IF NOT EXISTS sent_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  pncp_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, pncp_id)
);

-- Habilitar RLS
ALTER TABLE sent_alerts ENABLE ROW LEVEL SECURITY;

-- Usuário só pode ver seus próprios registros (se necessário exibir histórico ao usuário)
CREATE POLICY "Users can view own sent alerts"
ON sent_alerts FOR SELECT
USING (auth.uid() = user_id);
