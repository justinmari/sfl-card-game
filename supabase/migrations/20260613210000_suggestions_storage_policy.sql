-- Allow authenticated users to upload images to card-images/suggestions/
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload suggestions' AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Users can upload suggestions"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'card-images'
        AND (storage.foldername(name))[1] = 'suggestions'
        AND auth.uid() IS NOT NULL
      );
  END IF;
END $$;
