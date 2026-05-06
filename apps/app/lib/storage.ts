import { useSupabaseClient } from '#imports';

/**
 * Upload a profile photo and return the public URL.
 * If currentAvatarUrl is provided and points to Supabase storage,
 * the old file is deleted (best-effort) after the new upload succeeds.
 */
export async function uploadProfilePhoto(
  file: File,
  userId: string,
  currentAvatarUrl?: string | null
): Promise<string | null> {
  const supabase = useSupabaseClient();
  const filePath = `${userId}/avatar-${Date.now()}.${file.name.split('.').pop()}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(filePath);

  // Clean up old avatar (best-effort, fire-and-forget)
  if (currentAvatarUrl) {
    const marker = '/object/public/avatars/';
    const markerIndex = currentAvatarUrl.indexOf(marker);
    if (markerIndex !== -1) {
      const oldPath = currentAvatarUrl.substring(markerIndex + marker.length);
      if (oldPath) {
        supabase.storage
          .from('avatars')
          .remove([oldPath])
          .catch(() => {});
      }
    }
  }

  return publicUrl;
}
