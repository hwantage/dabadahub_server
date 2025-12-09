// config/database.js
// for PostgreSQL (Supabase)
// 로컬 개발 환경에서는 .env 파일 사용
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

module.exports = {
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "postgres",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  port: parseInt(process.env.DB_PORT) || 5432,
  ssl: {
    rejectUnauthorized: false,
  },
};
