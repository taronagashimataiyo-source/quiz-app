import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const missingKeys = [
  !supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL' : null,
  !supabaseAnonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : null,
].filter(Boolean);

export const supabaseConfigError =
  missingKeys.length > 0
    ? `Supabase設定が未完了です。VercelのEnvironment Variablesに以下を設定してください: ${missingKeys.join(', ')}`
    : null;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const ROOM_ID = 'default-room';
