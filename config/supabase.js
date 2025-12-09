// config/supabase.js
// Supabase Client Configuration
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";

// 서버 환경에서는 localStorage가 없으므로 세션 저장 비활성화
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// Storage bucket name
const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME;

module.exports = {
  supabase,
  BUCKET_NAME,
};

