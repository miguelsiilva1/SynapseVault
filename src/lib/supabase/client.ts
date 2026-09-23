import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return dummy client if env unconfigured to avoid client-side crash during setup
    return createBrowserClient('https://placeholder-project.supabase.co', 'placeholder-anon-key');
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
