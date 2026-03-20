CREATE POLICY "Admins can update pdfs"
  ON public.uploaded_pdfs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pdfs"
  ON public.uploaded_pdfs FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));