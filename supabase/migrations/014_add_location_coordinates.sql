-- Add latitude and longitude columns to locations table
-- These will store GPS coordinates for map display

ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Create index for faster geo queries
CREATE INDEX IF NOT EXISTS idx_locations_coordinates 
ON public.locations (latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add a comment explaining the columns
COMMENT ON COLUMN public.locations.latitude IS 'GPS latitude coordinate for map display';
COMMENT ON COLUMN public.locations.longitude IS 'GPS longitude coordinate for map display';
