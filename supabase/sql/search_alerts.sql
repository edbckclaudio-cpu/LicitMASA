CREATE TABLE IF NOT EXISTS search_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  keyword TEXT NOT NULL,
  uf CHAR(2),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE search_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
ON search_alerts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own alerts"
ON search_alerts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
ON search_alerts FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts"
ON search_alerts FOR DELETE
USING (auth.uid() = user_id);
