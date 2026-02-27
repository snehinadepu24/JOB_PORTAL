import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: './config/config.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key is missing!');
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
