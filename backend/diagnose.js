const { supabase } = require('./supabase');

async function checkSchema() {
  console.log('Checking auction_state table...');
  try {
    const { data, error } = await supabase
      .from('auction_state')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('Error fetching auction_state:', error.message);
      return;
    }

    console.log('Current auction_state:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkSchema();
