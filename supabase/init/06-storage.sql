-- ==============================================================================
-- 7. STORAGE SETUP
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('portal-uploads', 'portal-uploads', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT TO public USING ( bucket_id = 'portal-uploads' );
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'portal-uploads' );
DROP POLICY IF EXISTS "Owner Update" ON storage.objects;
CREATE POLICY "Owner Update" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'portal-uploads' AND (select auth.uid()) = owner );
DROP POLICY IF EXISTS "Owner Delete" ON storage.objects;
CREATE POLICY "Owner Delete" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'portal-uploads' AND (select auth.uid()) = owner );
