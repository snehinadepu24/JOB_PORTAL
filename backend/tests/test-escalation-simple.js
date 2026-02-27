console.log('Starting test...');

try {
  const NegotiationBot = await import('../managers/NegotiationBot.js');
  console.log('NegotiationBot imported successfully');
  
  const { supabase } = await import('../database/supabaseClient.js');
  console.log('Supabase imported successfully');
  
  console.log('All imports successful!');
} catch (error) {
  console.error('Import failed:', error.message);
  process.exit(1);
}
