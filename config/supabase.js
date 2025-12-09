// config/supabase.js
// Supabase Client Configuration
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL || "https://mquahiwmjkxikfkpkahl.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

// Storage bucket name
const BUCKET_NAME = "dabadahub";

module.exports = {
  supabase,
  BUCKET_NAME,
};

