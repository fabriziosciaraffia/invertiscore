-- Add onboarding_completed flag to user_credits
-- Used to show the onboarding/welcome screen once after signup
ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
