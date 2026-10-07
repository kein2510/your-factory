import { createClient } from "@supabase/supabase-js";

// Your Factory - Supabaseクライアント設定
const DEFAULT_SUPABASE_URL = "https://ohgfaabrdgzuapyquqzh.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oZ2ZhYWJyZGd6dWFweXF1cXpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNzkzNTAsImV4cCI6MjEwNjk1NTM1MH0.tn2kPL6poeb_r4JGTyclOmEbq-edEnfzNR-3_pAR9D0";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith("http") && 
  !supabaseUrl.includes("placeholder")
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    })
  : (null as unknown as ReturnType<typeof createClient>);
