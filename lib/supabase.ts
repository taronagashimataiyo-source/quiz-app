import { createClient } from '@supabase/supabase-js';

const requiredEnvKeys = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;
const missingKeys = requiredEnvKeys.filter((key) => !process.env[key]);

export const supabaseConfigError =
  missingKeys.length > 0
    ? `Supabase設定が未完了です。 .env.local に以下を設定してください: ${missingKeys.join(', ')}`
    : null;

export const supabase =
  supabaseConfigError
    ? null
    : createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export const ROOM_ID = 'default-room';
