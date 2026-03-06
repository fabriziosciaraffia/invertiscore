-- Allow anyone (including anonymous/unauthenticated) to read analyses by ID
-- This enables sharing analysis links publicly (viralidad)
CREATE POLICY "Anyone can read analisis"
  ON analisis FOR SELECT USING (true);
