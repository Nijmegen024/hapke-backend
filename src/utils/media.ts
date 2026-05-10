/**
 * Strips the Supabase public URL from a string, returning only the relative path.
 * If the string does not contain the Supabase URL, it is returned as-is.
 */
export function stripSupabaseUrl(url: string | null): string | null {
  if (!url) return null;
  
  // Matches any Supabase storage public URL pattern
  // Pattern: https://[project-ref].supabase.co/storage/v1/object/public/[bucket]/[path]
  const regex = /https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/[^/]+\//;
  
  return url.replace(regex, '');
}
