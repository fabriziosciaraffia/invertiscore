-- Add geocode_attempted column to avoid retrying failed geocoding
ALTER TABLE scraped_properties ADD COLUMN IF NOT EXISTS geocode_attempted BOOLEAN DEFAULT FALSE;
