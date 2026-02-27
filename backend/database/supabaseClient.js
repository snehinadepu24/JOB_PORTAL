import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple paths for config.env
const configPaths = [
  './config/config.env',
  path.join(__dirname, '../config/config.env'),
  path.join(process.cwd(), 'config/config.env')
];

for (const configPath of configPaths) {
  config({ path: configPath });
  if (process.env.SUPABASE_URL) break;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key is missing!');
  console.error('Tried config paths:', configPaths);
  console.error('Current working directory:', process.cwd());
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error && error.code !== 'PGRST116') {
      console.log('Supabase connection test:', error.message);
    } else {
      console.log('Supabase Connected Successfully!');
    }
  } catch (error) {
    console.log('Supabase connection error:', error.message);
  }
};

testConnection();
