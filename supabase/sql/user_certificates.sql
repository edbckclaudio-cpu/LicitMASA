CREATE TABLE IF NOT EXISTS user_certificates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  certificate_name TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  notified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own certificates"
ON user_certificates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own certificates"
ON user_certificates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own certificates"
ON user_certificates FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own certificates"
ON user_certificates FOR DELETE
USING (auth.uid() = user_id);
