ALTER TABLE public.github_settings
  ADD COLUMN IF NOT EXISTS branch text NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS folder text DEFAULT '';