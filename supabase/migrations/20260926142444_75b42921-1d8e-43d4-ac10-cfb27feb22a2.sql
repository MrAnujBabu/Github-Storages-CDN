DROP POLICY IF EXISTS "Anyone can read github_settings" ON public.github_settings;
DROP POLICY IF EXISTS "Public can read pdfs by id" ON public.uploaded_pdfs;
REVOKE SELECT ON public.uploaded_pdfs FROM anon;