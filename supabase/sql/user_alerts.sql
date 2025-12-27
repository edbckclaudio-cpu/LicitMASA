-- Tabela para armazenar as preferências de busca automática 
CREATE TABLE public.user_alerts ( 
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY, 
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, 
    
    -- Filtros de busca 
    keywords TEXT[] DEFAULT '{}', -- Ex: ['limpeza', 'papel', 'copos'] 
    ufs TEXT[] DEFAULT '{}',      -- Ex: ['SP', 'RJ', 'MG'] 
    valor_minimo NUMERIC DEFAULT 0, 
    
    -- Configurações de Notificação 
    whatsapp_notificacao BOOLEAN DEFAULT false, 
    whatsapp_numero TEXT, 
    push_notificacao BOOLEAN DEFAULT true, 
    
    -- Controle de Automação 
    ativo BOOLEAN DEFAULT true, 
    ultima_busca_em TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL, 
 
    -- Um alerta por usuário (ou pode remover para permitir múltiplos perfis de busca) 
    UNIQUE(user_id) 
); 
 
-- Ativar Segurança (RLS) 
ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY; 
 
 -- Políticas RLS: dono pode ver; inserir/atualizar exigem validação do user_id
 CREATE POLICY "User can select own alerts"
 ON public.user_alerts FOR SELECT
 USING (auth.uid() = user_id);
 
 CREATE POLICY "User can insert own alerts"
 ON public.user_alerts FOR INSERT
 WITH CHECK (auth.uid() = user_id);
 
 CREATE POLICY "User can update own alerts"
 ON public.user_alerts FOR UPDATE
 USING (auth.uid() = user_id)
 WITH CHECK (auth.uid() = user_id);
 
-- Tabela auxiliar para logs de notificações enviadas (evita duplicidade) 
CREATE TABLE public.sent_notifications ( 
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY, 
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, 
    pncp_id TEXT NOT NULL, 
    enviado_em TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    UNIQUE(user_id, pncp_id) 
);

ALTER TABLE public.user_alerts ADD COLUMN IF NOT EXISTS fcm_token TEXT;
