-- Franco: Payments & Credits Schema
-- Run this in Supabase SQL Editor

-- Tabla de pagos/transacciones
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  flow_order BIGINT,
  commerce_order TEXT UNIQUE NOT NULL,
  product TEXT NOT NULL CHECK (product IN ('pro', 'pack3', 'subscription')),
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'CLP',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected', 'cancelled')),
  flow_status INTEGER,
  analysis_id UUID,
  payment_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de créditos del usuario
CREATE TABLE IF NOT EXISTS user_credits (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  credits INTEGER DEFAULT 0,
  subscription_status TEXT DEFAULT 'none' CHECK (subscription_status IN ('none', 'active', 'cancelled', 'past_due')),
  subscription_id TEXT,
  flow_customer_id TEXT,
  subscription_start TIMESTAMPTZ,
  subscription_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_commerce_order ON payments(commerce_order);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users see own credits" ON user_credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access payments" ON payments
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access credits" ON user_credits
  FOR ALL USING (auth.role() = 'service_role');
