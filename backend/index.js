const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.get('/api/test', async (req, res) => {
  const { data, error } = await supabase.from('usuarios').select('*');
  if (error) {
    return res.status(400).json({ error: error.message });
  }
  return res.json({
    ok: true,
    mensaje: 'Conectado a Supabase desde el backend.',
    data,
  });
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});