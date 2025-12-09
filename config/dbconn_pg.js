// config/database.js
// for PostgreSQL (Supabase Pooler)
// 로컬 개발 환경에서는 .env 파일 사용
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

module.exports = {
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: {
    rejectUnauthorized: false,
  },
};
