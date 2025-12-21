CREATE TABLE IF NOT EXISTS alert_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID REFERENCES search_alerts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  keyword TEXT,
  uf CHAR(2),
  found_count INTEGER NOT NULL DEFAULT 0,
  notified_count INTEGER NOT NULL DEFAULT 0,
  channel TEXT CHECK (channel IN ('email','push','none')) DEFAULT 'none',
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE alert_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert runs"
ON alert_runs FOR SELECT
USING (auth.uid() = user_id);
